import * as THREE from "three";
import { AUTOSAVE_INTERVAL_MS, CHUNK_HEIGHT, TICKS_PER_SECOND } from "./config";
import { DropManager } from "./entities/drops";
import type { Input } from "./input/input";
import { HOTBAR_SIZE, Inventory, type ItemStack } from "./items/inventory";
import type { WorkerPool } from "./mesher/pool";
import { Interaction } from "./player/interaction";
import { Player } from "./player/player";
import type { BlockMaterials } from "./render/materials";
import { SelectionBox } from "./render/selection";
import { listChunkKeys, listEntityKeys, loadChunk, loadEntities, putWorld, saveChunks, saveEntities, type EntityRecord, type WorldMeta } from "./save/db";
import { seededChunkAnimals } from "./entities/spawnRules";
import type { Audio } from "./audio/audio";
import type { GameMode } from "./player/player";
import { Vitals } from "./player/vitals";
import { BLOCKS, B, I, IS_SOLID, getItem } from "./world/blocks";
import type { Chunk } from "./world/chunk";
import { World, type ChunkStore } from "./world/world";
import { EventBus, type GameEvents } from "./events";
import { AchievementTracker, emptyAchievementState } from "./achievements/tracker";
import type { AchievementDef } from "./achievements/achievements";
import { FluidSimulator } from "./world/fluid";
import { armorReduction, arrowDamage, attackDamage, bowPower, fallDamage, wearFor, type Attackable } from "./items/combat";
import { DAY_TICKS } from "./config";
import { EntityManager } from "./entities/entityManager";
import { ProjectileManager } from "./entities/projectiles";
import { XpOrbManager } from "./entities/xpOrbs";
import { Experience } from "./player/experience";
import { SPAWN_CONFIG } from "./entities/spawnConfig";
import { Spawner } from "./entities/spawner";
import type { Mob } from "./entities/mob";
import { MOB_LIST, MOB_TYPES, type MobType } from "./entities/mobTypes";

class DbChunkStore implements ChunkStore {
  constructor(private worldId: string, private keys: Set<string>) {}
  has(cx: number, cz: number) {
    return this.keys.has(`${cx},${cz}`);
  }
  load(cx: number, cz: number) {
    return loadChunk(this.worldId, cx, cz);
  }
  save(chunk: Chunk) {
    // Called for unloading chunks; the block array is no longer shared after this.
    this.keys.add(`${chunk.cx},${chunk.cz}`);
    chunk.unsaved = false;
    void saveChunks(this.worldId, [chunk]);
  }
  markSaved(chunks: Chunk[]) {
    for (const c of chunks) this.keys.add(`${c.cx},${c.cz}`);
  }
}

export interface SessionEvents {
  openCrafting(): void;
}

const CREATIVE_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLESTONE, B.PLANKS, B.LOG, B.GLASS, B.TORCH, B.CRAFTING_TABLE];

/** One open world: terrain streaming, the player, items and saving. */
export class Session {
  readonly world: World;
  readonly player: Player;
  readonly inventory = new Inventory();
  readonly interaction: Interaction;
  readonly vitals = new Vitals();
  /** 0..1 while holding right click to eat. */
  eating = 0;
  private eatSoundTimer = 0;
  private voidTimer = 0;
  private deathHandled = false;
  /** Gameplay events: achievements listen here, and so can future systems. */
  readonly events = new EventBus<GameEvents>();
  readonly achievements: AchievementTracker;
  readonly fluid: FluidSimulator;
  readonly entities: EntityManager;
  readonly projectiles = new ProjectileManager();
  readonly xpOrbs = new XpOrbManager();
  readonly xp = new Experience();
  /** Seconds the bow has been drawn (0 when not drawing). */
  bowDraw = 0;
  readonly spawner: Spawner;
  /** Set from the options screen. */
  mobRules = { mobs: true, peaceful: false };
  private debugSpawnIndex = 0;
  onAchievement: ((def: AchievementDef) => void) | null = null;
  /** Called after the player hits something; combat systems hook in here. */
  onAttack: ((target: Attackable, damage: number) => void) | null = null;
  /** Seconds of unpaused play; the autosave clock runs on this. */
  private playTime = 0;
  private nextAutosave = AUTOSAVE_INTERVAL_MS / 1000;
  private fluidTimer = 0;
  private positionTimer = 0;
  private wasInWater = false;
  private lastDay = -1;
  private joined = false;
  private diedSinceSunrise = false;
  readonly drops: DropManager;
  readonly selection = new SelectionBox();
  readonly group = new THREE.Group();
  time: number;
  /** True once the chunk under the player is meshed and physics may run. */
  ready = false;
  private store: DbChunkStore | null;
  private saving: Promise<void> | null = null;
  private spawnPending: { x: number; z: number; y: number | null };
  private daylight = 1;

  static async open(meta: WorldMeta, pool: WorkerPool, materials: BlockMaterials, audio: Audio, events: SessionEvents, persist = true) {
    const keys = persist ? await listChunkKeys(meta.id).catch(() => new Set<string>()) : new Set<string>();
    const entityKeys = persist ? await listEntityKeys(meta.id).catch(() => new Set<string>()) : new Set<string>();
    return new Session(meta, pool, materials, audio, events, persist ? new DbChunkStore(meta.id, keys) : null, entityKeys);
  }

  private constructor(
    readonly meta: WorldMeta,
    pool: WorkerPool,
    materials: BlockMaterials,
    private audio: Audio,
    private hooks: SessionEvents,
    store: DbChunkStore | null,
    /** Chunks whose animals were already generated (and saved) at some point. */
    private entityKeys: Set<string> = new Set(),
  ) {
    this.store = store;
    this.world = new World(meta.seed, pool, materials, store);
    this.player = new Player(this.world);
    this.player.mode = meta.mode;
    this.time = meta.time;
    this.drops = new DropManager(this.world, materials.entity);
    meta.achievements ??= emptyAchievementState();
    this.achievements = new AchievementTracker(meta.achievements, this.events, (def) => {
      this.onAchievement?.(def);
      void this.save().catch(() => {});
    });
    this.entities = new EntityManager(this.world, {
      spawnDrop: (item, count, x, y, z) => this.drops.spawn(item, count, x, y, z),
      onMobKilled: (mob) => this.onMobKilled(mob),
      spawnXp: (points, x, y, z) => this.xpOrbs.spawn(points, x, y, z),
      shootArrow: (mob, target) => this.mobShoots(mob, target),
    });
    this.group.add(this.entities.group, this.projectiles.group, this.xpOrbs.group);
    this.spawner = new Spawner(this.world, this.entities);
    this.world.onChunkLoaded = (chunk) => this.chunkEntitiesIn(chunk.cx, chunk.cz, (x, y, z) => chunk.get(x, y, z));
    this.world.onChunkUnloaded = (chunk) => this.chunkEntitiesOut(chunk.cx, chunk.cz);
    this.fluid = new FluidSimulator(this.world);
    this.world.onBlockChange = (x, y, z) => this.fluid.notify(x, y, z);
    this.fluid.onWashedAway = (x, y, z, id) => {
      const drop = BLOCKS[id]?.drop;
      if (drop !== null && drop !== undefined && this.player.mode === "survival") this.drops.spawn(drop, 1, x + 0.5, y + 0.3, z + 0.5);
    };
    this.group.add(this.world.group, this.drops.group, this.selection.group);

    if (meta.player) {
      const p = meta.player;
      this.player.teleport(p.pos[0], p.pos[1], p.pos[2]);
      this.player.yaw = p.yaw;
      this.player.pitch = p.pitch;
      this.player.flying = p.flying && meta.mode === "creative";
      this.inventory.load(p.inventory, p.selected);
      this.inventory.loadArmor(p.armor);
      this.xp.total = p.xp ?? 0;
      this.vitals.load(p.vitals);
      this.spawnPending = { x: p.pos[0], z: p.pos[2], y: p.pos[1] };
    } else {
      const spawn = this.world.generator.findSpawn();
      this.player.teleport(spawn.x, spawn.y, spawn.z);
      this.spawnPending = { x: spawn.x, z: spawn.z, y: null };
      if (meta.mode === "creative") CREATIVE_HOTBAR.forEach((id, i) => (this.inventory.slots[i] = { id, count: 64 }));
    }

    this.player.onStep = (block) => this.audio.block(BLOCKS[block]?.sound ?? "none", "step");
    this.player.onLand = (block, fall) => {
      if (fall > 1.2) this.audio.block(BLOCKS[block]?.sound ?? "none", "step");
      // Gentler than one point per block: 4 blocks = 1, 8 = 4, 12 = 6 (3 hearts).
      if (this.player.mode === "survival" && !this.player.inWater) this.vitals.damage(fallDamage(fall), "fall");
    };
    this.vitals.onHurt = () => this.audio.hurt();

    this.interaction = new Interaction(this.world, this.player, {
      blockedByEntity: (x, y, z) => this.entities.occupies(x, y, z),
      pickEntity: (eye, dir, reach) => {
        if (!this.mobRules.mobs) return null;
        const hit = this.entities.pick(eye, dir, reach);
        return hit ? { target: hit.mob, dist: hit.dist } : null;
      },
      attackEntity: (target) => {
        this.attack(target);
      },
      heldItem: () => this.inventory.held?.id ?? 0,
      consumeHeld: () => this.inventory.removeFromSlot(this.inventory.selected, 1),
      onBlockBroken: (x, y, z, id, harvested) => {
        this.playAt(BLOCKS[id].sound, "break", x, y, z);
        const tool = this.inventory.held?.id ?? 0;
        this.events.emit("blockBroken", { id, x, y, z, harvested, tool });
        if (this.player.mode === "survival") {
          this.vitals.exhaust(0.005);
          if (harvested && id === B.COAL_ORE) this.xpOrbs.spawn(Math.floor(Math.random() * 3), x + 0.5, y + 0.5, z + 0.5);
          if (BLOCKS[id].hardness > 0) this.wearHeld(wearFor(tool, "block"));
        }
        if (!harvested) return;
        const drop = this.dropFor(id);
        if (drop) this.drops.spawn(drop.id, drop.count, x + 0.5, y + 0.4, z + 0.5);
      },
      onBlockPlaced: (x, y, z, id) => {
        this.playAt(BLOCKS[id].sound, "place", x, y, z);
        this.events.emit("blockPlaced", { id, x, y, z });
      },
      onUseBlock: (_x, _y, _z, id) => {
        if (id !== B.CRAFTING_TABLE) return false;
        this.hooks.openCrafting();
        return true;
      },
      onSwing: () => this.onSwing?.(),
      onDigTick: (id) => {
        const t = this.interaction.target;
        if (t) this.playAt(BLOCKS[id].sound, "dig", t.x, t.y, t.z);
      },
    });
  }

  onSwing: (() => void) | null = null;
  /** Short action-bar message, e.g. explaining why something did nothing. */
  onHint: ((text: string) => void) | null = null;
  private hintsShown = new Set<string>();

  private hint(key: string, text: string) {
    if (this.hintsShown.has(key)) return;
    this.hintsShown.add(key);
    this.onHint?.(text);
  }

  get mode() {
    return this.player.mode;
  }

  /** Switches Survival/Creative for this world (saved with it). */
  setMode(mode: GameMode) {
    this.player.mode = mode;
    this.meta.mode = mode;
    if (mode === "survival") this.player.flying = false;
    this.hintsShown.clear();
  }

  /** Spends durability on the held item and breaks it when used up. */
  private wearHeld(amount: number) {
    const slot = this.inventory.selected;
    const held = this.inventory.slots[slot];
    const max = held ? getItem(held.id)?.durability : undefined;
    if (!held || !max || amount <= 0 || this.player.mode !== "survival") return;
    held.wear = (held.wear ?? 0) + amount;
    if (held.wear >= max) {
      this.inventory.slots[slot] = null;
      this.audio.block("wood", "break");
      this.onHint?.(`Your ${getItem(held.id)?.name ?? "tool"} broke`);
    }
    this.inventory.changed();
  }

  /**
   * Melee hit with whatever is in hand. Nothing in the world can be hit yet;
   * this is the entry point for mobs or players later.
   */
  attack(target: Attackable): number {
    const weapon = this.inventory.held?.id ?? 0;
    const damage = attackDamage(weapon);
    target.hurt(damage, { weapon, from: { x: this.player.pos.x, z: this.player.pos.z } });
    const mob = target as Partial<Mob>;
    if (mob.def) this.audio.mobHurt(mob.def.voice, !!mob.dead);
    this.wearHeld(wearFor(weapon, "attack"));
    this.events.emit("attack", { weapon, damage, target: target.name });
    this.onAttack?.(target, damage);
    this.onSwing?.();
    return damage;
  }

  /** Chunks whose mobs are live in memory right now. */
  private liveEntityChunks = new Set<string>();

  /**
   * A chunk came into memory: bring back its saved mobs, or, the very first
   * time the chunk exists, roll its seeded animal packs.
   */
  private chunkEntitiesIn(cx: number, cz: number, blockAt: (x: number, y: number, z: number) => number) {
    const key = `${cx},${cz}`;
    if (this.liveEntityChunks.has(key)) return;
    this.liveEntityChunks.add(key);
    const spawnRecord = (r: EntityRecord) => {
      if (!(r.type in MOB_TYPES)) return;
      this.entities.spawn(r.type as MobType, r.x, r.y, r.z, { persistent: true, color: r.color, baby: r.baby, health: r.health, yaw: r.yaw, age: r.age });
    };
    if (this.entityKeys.has(key)) {
      if (!this.store) return;
      void loadEntities(this.meta.id, cx, cz).then((list) => {
        if (this.liveEntityChunks.has(key)) list.forEach(spawnRecord);
      }, () => {});
      return;
    }
    this.entityKeys.add(key);
    const ox = cx * 16;
    const oz = cz * 16;
    for (const a of seededChunkAnimals(this.meta.seed, cx, cz, blockAt)) {
      this.entities.spawn(a.type, ox + a.x, a.y, oz + a.z, { persistent: true, color: a.color, baby: a.baby, yaw: a.yaw });
    }
    if (this.store) void saveEntities(this.meta.id, [{ cx, cz, list: this.entities.records(key) }]).catch(() => {});
  }

  /** A chunk is leaving memory: save its persistent mobs, forget everything in it. */
  private chunkEntitiesOut(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (!this.liveEntityChunks.delete(key)) return;
    if (this.store) void saveEntities(this.meta.id, [{ cx, cz, list: this.entities.records(key) }]).catch(() => {});
    this.entities.unloadChunk(key);
  }

  private onMobKilled(mob: Mob) {
    this.events.emit("mobKilled", { type: mob.type, hostile: mob.hostile, weapon: mob.lastWeapon, byPlayer: mob.killedByPlayer });
  }

  /** Debug: drop the next mob type a few blocks in front of the player. */
  debugSpawnNext(): MobType {
    const def = MOB_LIST[this.debugSpawnIndex++ % MOB_LIST.length];
    const look = this.player.look();
    const x = Math.floor(this.player.pos.x + look.x * 4);
    const z = Math.floor(this.player.pos.z + look.z * 4);
    let y = Math.min(CHUNK_HEIGHT - 3, Math.floor(this.player.pos.y) + 6);
    while (y > 1 && !IS_SOLID[this.world.getBlock(x, y - 1, z)]) y--;
    this.entities.spawn(def.type, x + 0.5, y, z + 0.5);
    return def.type;
  }

  /**
   * Damage from mobs and arrows: armor soaks part of it and takes wear; the
   * player is knocked away from the source.
   */
  hurtPlayer(amount: number, cause: "mob" | "arrow", fromX: number, fromZ: number) {
    const p = this.player;
    if (p.mode !== "survival" || this.vitals.dead) return;
    const points = this.inventory.armorPoints;
    this.vitals.damage(armorReduction(amount, points), cause);
    if (points > 0) {
      const wear = Math.max(1, Math.floor(amount / 4));
      this.inventory.armor.forEach((s, i) => {
        const max = s ? getItem(s.id)?.durability : undefined;
        if (!s || !max) return;
        s.wear = (s.wear ?? 0) + wear;
        if (s.wear >= max) {
          this.inventory.armor[i] = null;
          this.audio.block("stone", "break");
          this.onHint?.(`Your ${getItem(s.id)?.name ?? "armor"} broke`);
        }
      });
      this.inventory.changed();
    }
    const dx = p.pos.x - fromX;
    const dz = p.pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    p.vel.x += (dx / len) * (cause === "arrow" ? 3 : 6);
    p.vel.z += (dz / len) * (cause === "arrow" ? 3 : 6);
    p.vel.y = Math.max(p.vel.y, cause === "arrow" ? 3 : 4.5);
  }

  /** A Rattler looses an arrow at the target, leading for gravity with a little scatter. */
  private mobShoots(mob: Mob, target: { x: number; y: number; z: number }) {
    const from = new THREE.Vector3(mob.pos.x, mob.pos.y + mob.height * 0.82, mob.pos.z);
    const to = new THREE.Vector3(target.x, target.y + 1.1, target.z);
    const speed = SPAWN_CONFIG.archerArrowSpeed;
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const time = flat / speed;
    const dir = to.clone().sub(from);
    dir.y += 0.5 * 20 * time * time;
    dir.normalize();
    const spread = SPAWN_CONFIG.archerSpread;
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    from.addScaledVector(dir, 0.6);
    const [lo, hi] = SPAWN_CONFIG.archerArrowDamage;
    this.projectiles.shoot(from, dir.multiplyScalar(speed), { fromPlayer: false, shooter: mob, damage: lo + Math.floor(Math.random() * (hi - lo + 1)), pickup: true });
    this.audio.bowShot();
  }

  /** Hold right click with a bow to draw, release to shoot. Needs an arrow unless in Creative. */
  private updateBow(dt: number, input: Input, controls: boolean) {
    const held = this.inventory.held;
    const hasBow = held?.id === I.BOW;
    const creative = this.player.mode === "creative";
    const canShoot = creative || this.inventory.countOf(I.ARROW) > 0;
    if (controls && hasBow && canShoot && input.buttons.has(2)) {
      this.bowDraw += dt;
      return;
    }
    if (this.bowDraw > 0 && hasBow && controls) {
      const power = bowPower(this.bowDraw);
      if (power >= 0.1) {
        const eye = this.player.eye();
        const look = this.player.look();
        eye.addScaledVector(look, 0.4);
        this.projectiles.shoot(eye, look.multiplyScalar(48 * power), { fromPlayer: true, shooter: null, damage: arrowDamage(power), pickup: !creative });
        if (!creative) {
          this.inventory.take(I.ARROW, 1);
          this.wearHeld(1);
        }
        this.audio.bowShot();
        this.onSwing?.();
      }
    }
    this.bowDraw = 0;
  }

  /** Crafting screens report each craft here. */
  crafted(id: number, count: number) {
    this.events.emit("itemCrafted", { id, count });
  }

  private dropFor(id: number): ItemStack | null {
    if (id === B.LEAVES) {
      const r = Math.random();
      if (r < 0.05) return { id: I.APPLE, count: 1 };
      return r < 0.13 ? { id: I.STICK, count: 1 } : null;
    }
    const drop = BLOCKS[id]?.drop;
    return drop === null || drop === undefined ? null : { id: drop, count: 1 };
  }

  private playAt(kind: Parameters<Audio["block"]>[0], action: Parameters<Audio["block"]>[1], x: number, y: number, z: number) {
    const eye = this.player.eye();
    const dx = x + 0.5 - eye.x;
    const dz = z + 0.5 - eye.z;
    const dist = Math.hypot(dx, y + 0.5 - eye.y, dz);
    const right = new THREE.Vector2(Math.cos(this.player.yaw), -Math.sin(this.player.yaw));
    const len = Math.hypot(dx, dz) || 1;
    const pan = ((dx / len) * right.x + (dz / len) * right.y) * 0.7;
    this.audio.block(kind, action, pan, dist);
  }

  get daylightFactor() {
    return this.daylight;
  }

  set daylightFactor(v: number) {
    this.daylight = v;
  }

  private surfaceY(x: number, z: number) {
    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
      if (IS_SOLID[this.world.getBlock(x, y, z)]) return y + 1;
    }
    return CHUNK_HEIGHT - 10;
  }

  /** Progress 0..1 of the area around spawn being ready (for the loading screen). */
  loadingProgress() {
    const { ready, total } = this.world.readyAround(this.spawnPending.x, this.spawnPending.z, 2);
    return ready / total;
  }

  /** Throws the selected item (whole stack with `all`). */
  dropHeld(all: boolean) {
    const held = this.inventory.held;
    if (!held) return;
    const taken = this.inventory.removeFromSlot(this.inventory.selected, all ? held.count : 1);
    if (taken) this.throwStack(taken);
  }

  throwStack(stack: ItemStack) {
    const eye = this.player.eye();
    const look = this.player.look();
    const vel = look.clone().multiplyScalar(6);
    vel.y += 1.5;
    this.drops.spawn(stack.id, stack.count, eye.x + look.x * 0.4, eye.y - 0.3, eye.z + look.z * 0.4, vel, 1.5, stack.wear);
  }

  /** Middle click: grab the targeted block into the hotbar. */
  pickBlock() {
    const t = this.interaction.target;
    if (!t || !getItem(t.id)) return;
    const slots = this.inventory.slots;
    const existing = slots.findIndex((s, i) => i < HOTBAR_SIZE && s?.id === t.id);
    if (existing >= 0) this.inventory.selected = existing;
    else if (this.player.mode === "creative") slots[this.inventory.selected] = { id: t.id, count: 64 };
    this.inventory.changed();
  }

  update(dt: number, input: Input, controls: boolean, renderDistance: number) {
    this.world.renderDistance = renderDistance;
    const p = this.player;
    if (!this.ready) {
      const { x, z } = this.spawnPending;
      const chunk = this.world.chunkAt(Math.floor(Math.floor(x) / 16), Math.floor(Math.floor(z) / 16));
      if (chunk?.light) {
        const y = this.spawnPending.y ?? this.surfaceY(Math.floor(x), Math.floor(z));
        p.teleport(x, y, z);
        this.ready = true;
      }
    }

    if (this.ready) {
      this.time += dt * TICKS_PER_SECOND;
      this.playTime += dt;
      if (!this.joined) {
        this.joined = true;
        this.lastDay = Math.floor(this.time / DAY_TICKS);
        this.events.emit("joined", {});
      }
      if (controls) {
        for (let i = 0; i < HOTBAR_SIZE; i++) if (input.pressed.has(`Digit${i + 1}`)) this.inventory.selected = i;
        if (input.wheel) {
          this.inventory.selected = (((this.inventory.selected + input.wheel) % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
        }
        if (input.pressed.has("KeyQ")) this.dropHeld(input.keys.has("ControlLeft") || input.keys.has("MetaLeft"));
        if (input.clicked.has(1)) this.pickBlock();
        if (p.mode === "survival") {
          const held = this.inventory.held;
          const heldItem = held ? getItem(held.id) : undefined;
          if (input.clicked.has(2) && this.interaction.target && this.interaction.target.id !== B.CRAFTING_TABLE && !heldItem?.block && !heldItem?.food) {
            this.hint(
              held ? "place-item" : "place-empty",
              held ? "That item can't be placed - pick a block in your hotbar" : "Nothing to place - mine blocks to collect them, or use Creative",
            );
          }
        }
      }
      const alive = !this.vitals.dead;
      p.update(dt, input, controls && alive);
      this.interaction.update(dt, input, controls && alive);
      this.updateSurvival(dt, input, controls && alive);
      this.drops.update(dt, p, this.daylight, (id, count, wear) => {
        if (this.vitals.dead) return count;
        const left = this.inventory.add(id, count, wear);
        if (left < count) {
          this.audio.pickup();
          this.events.emit("itemPickedUp", { id, count: count - left });
        }
        return left;
      });

      const targetable = p.mode === "survival" && alive;
      // Mobs off: saved animals stay in the save but are frozen and hidden.
      this.entities.group.visible = this.mobRules.mobs;
      if (this.mobRules.mobs) this.entities.update(dt, {
        time: this.playTime,
        daylight: this.daylight,
        isDay: this.daylight > 0.75,
        target: targetable ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : null,
        hurtTarget: (mob, amount) => this.hurtPlayer(amount, "mob", mob.pos.x, mob.pos.z),
      });
      if (this.mobRules.mobs) this.projectiles.update(dt, this.entities.solidAt, {
        player: () => (alive ? { x: p.pos.x, y: p.pos.y, z: p.pos.z, half: p.half, height: p.height } : null),
        hitPlayer: (damage, from) => this.hurtPlayer(damage, "arrow", from.x, from.z),
        mobs: () => this.entities.mobs.values(),
        hitMob: (mob, damage, from) => {
          mob.hurt(damage, { weapon: I.BOW, from: { x: from.x, z: from.z } });
          this.audio.mobHurt(mob.def.voice, mob.dead);
        },
        pickup: () => {
          if (p.mode === "creative") return true;
          const left = this.inventory.add(I.ARROW, 1);
          if (left === 0) this.audio.pickup();
          return left === 0;
        },
        thud: (x, y, z) => this.playAt("wood", "step", Math.floor(x), Math.floor(y), Math.floor(z)),
      });
      this.xpOrbs.update(dt, this.entities.solidAt, alive && p.mode === "survival" ? p.pos.clone().setY(p.pos.y + 0.8) : null, (value) => {
        this.xp.add(value);
        this.audio.xpOrb();
      }, this.playTime);
      this.updateBow(dt, input, controls && alive);

      this.spawner.update(dt, {
        player: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
        timeTicks: this.time,
        passiveEnabled: this.mobRules.mobs,
        hostileEnabled: this.mobRules.mobs && !this.mobRules.peaceful,
      });

      // Water flows on its own clock, a quarter second per step.
      this.fluidTimer += dt;
      while (this.fluidTimer >= 0.25) {
        this.fluidTimer -= 0.25;
        this.fluid.tick();
      }

      if (p.inWater && !this.wasInWater) this.events.emit("enterWater", {});
      this.wasInWater = p.inWater;
      const day = Math.floor(this.time / DAY_TICKS);
      if (day > this.lastDay) {
        this.lastDay = day;
        this.events.emit("dayPassed", { day });
        // Day boundaries are sunrises, so reaching one alive means the night was survived.
        if (p.mode === "survival" && !this.diedSinceSunrise && !this.vitals.dead) this.events.emit("nightSurvived", { day });
        this.diedSinceSunrise = false;
      }
      this.positionTimer += dt;
      if (this.positionTimer >= 1) {
        this.positionTimer = 0;
        this.events.emit("position", { x: p.pos.x, y: p.pos.y, z: p.pos.z });
        let sheep = 0;
        for (const m of this.entities.mobs.values()) {
          if (m.type === "sheep" && !m.dead && m.pos.distanceToSquared(p.pos) < 16 * 16) sheep++;
        }
        if (sheep >= 3) this.events.emit("flockSeen", { count: sheep });
      }
      if (p.mode === "creative" && p.pos.y < -40) p.teleport(p.pos.x, this.surfaceY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 1, p.pos.z);
    }
    const t = this.interaction.target;
    if (t && controls) this.selection.show(t.x, t.y, t.z, t.id, this.interaction.progress);
    else this.selection.hide();
    this.world.update(p.pos.x, p.pos.z);
  }

  private updateSurvival(dt: number, input: Input, controls: boolean) {
    const p = this.player;
    const ex = p.exertion;
    if (p.mode !== "survival") {
      ex.sprint = ex.swim = ex.jumps = ex.sprintJumps = 0;
      this.eating = 0;
      return;
    }
    this.vitals.exhaust(ex.sprint * 0.1 + ex.swim * 0.01 + ex.jumps * 0.05 + ex.sprintJumps * 0.2);
    ex.sprint = ex.swim = ex.jumps = ex.sprintJumps = 0;
    this.vitals.tick(dt, p.headInWater);

    if (p.pos.y < -8) {
      this.voidTimer += dt;
      if (this.voidTimer >= 0.5) {
        this.voidTimer = 0;
        this.vitals.damage(4, "void");
      }
    }

    // Eating: hold right click with food for 1.6 s.
    const held = this.inventory.held;
    const food = held ? getItem(held.id)?.food : undefined;
    if (controls && food && this.vitals.food < 20 && input.buttons.has(2)) {
      this.eating += dt / 1.6;
      this.eatSoundTimer -= dt;
      if (this.eatSoundTimer <= 0) {
        this.audio.eat();
        this.eatSoundTimer = 0.22;
      }
      if (this.eating >= 1) {
        this.vitals.eat(food.hunger, food.saturation);
        this.events.emit("itemEaten", { id: held!.id });
        this.inventory.removeFromSlot(this.inventory.selected, 1);
        this.audio.burp();
        this.eating = 0;
        input.buttons.delete(2);
      }
    } else {
      this.eating = 0;
      this.eatSoundTimer = 0;
    }

    if (this.vitals.dead && !this.deathHandled) {
      const xpDrop = this.xp.dropOnDeath();
      if (xpDrop > 0) this.xpOrbs.spawn(xpDrop, p.pos.x, Math.max(p.pos.y, 1) + 0.5, p.pos.z);
      this.bowDraw = 0;
      this.deathHandled = true;
      // Everything you carried spills where you fell.
      for (let i = 0; i < this.inventory.slots.length; i++) {
        const s = this.inventory.slots[i];
        if (!s) continue;
        const vel = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4);
        this.drops.spawn(s.id, s.count, p.pos.x, Math.max(p.pos.y, 1) + 1, p.pos.z, vel, 1, s.wear);
        this.inventory.slots[i] = null;
      }
      this.inventory.changed();
      this.events.emit("died", { cause: this.vitals.lastCause });
      this.diedSinceSunrise = true;
    }
  }

  /** Back to the world spawn with full health and an empty inventory. */
  respawn() {
    this.vitals.reset();
    this.deathHandled = false;
    this.eating = 0;
    const spawn = this.world.generator.findSpawn();
    this.player.vel.set(0, 0, 0);
    this.player.flying = false;
    this.spawnPending = { x: spawn.x, z: spawn.z, y: null };
    this.player.teleport(spawn.x, spawn.y + 1, spawn.z);
    this.ready = false;
    this.events.emit("respawned", {});
  }

  /** True every 30 s of unpaused play. */
  shouldAutosave() {
    if (this.playTime < this.nextAutosave) return false;
    this.nextAutosave = this.playTime + AUTOSAVE_INTERVAL_MS / 1000;
    return true;
  }

  snapshotMeta(): WorldMeta {
    const p = this.player;
    return {
      ...this.meta,
      lastPlayed: Date.now(),
      time: Math.floor(this.time),
      player: {
        pos: [p.pos.x, p.pos.y, p.pos.z],
        yaw: p.yaw,
        pitch: p.pitch,
        flying: p.flying,
        inventory: this.inventory.serialize(),
        selected: this.inventory.selected,
        vitals: this.vitals.serialize(),
        armor: this.inventory.serializeArmor(),
        xp: this.xp.total,
      },
    };
  }

  /** Writes edited chunks and the player/world metadata. Concurrent calls share one save. */
  save(thumbnail?: string): Promise<void> {
    if (!this.store) return Promise.resolve();
    if (this.saving) return this.saving;
    const chunks = this.world.unsavedChunks();
    // Copy so later edits do not race the transaction.
    const payload = chunks.map((c) => ({ cx: c.cx, cz: c.cz, blocks: c.blocks.slice() }));
    for (const c of chunks) c.unsaved = false;
    const meta = this.snapshotMeta();
    if (thumbnail) meta.thumbnail = thumbnail;
    else if (this.meta.thumbnail) meta.thumbnail = this.meta.thumbnail;
    if (thumbnail) this.meta.thumbnail = thumbnail;
    this.saving = (async () => {
      try {
        await saveChunks(this.meta.id, payload);
        await saveEntities(this.meta.id, [...this.liveEntityChunks].map((key) => {
          const [cx, cz] = key.split(",").map(Number);
          return { cx, cz, list: this.entities.records(key) };
        }));
        this.store!.markSaved(chunks);
        await putWorld(meta);
      } catch (err) {
        for (const c of chunks) c.unsaved = true;
        console.error("[blockvale] save failed", err);
        throw err;
      } finally {
        this.saving = null;
      }
    })();
    return this.saving;
  }

  dispose() {
    this.achievements.dispose();
    this.events.clear();
    this.fluid.clear();
    this.entities.clear();
    this.projectiles.clear();
    this.xpOrbs.clear();
    this.drops.clear();
    this.world.dispose();
  }
}
