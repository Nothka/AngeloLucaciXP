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
import {
  BLOCKS, B, I, IS_SOLID, doorState, getItem, isButton, isDoor, isLever, isPlate, isWater, isWheat, leverBlock,
  buttonBlock, supports, switchFace, switchOn,
} from "./world/blocks";
import { BlockUpdates, blockDrops, blockXp } from "./world/blockUpdates";
import { FallingBlocks } from "./world/gravity";
import { FurnaceRegistry, type FurnaceState } from "./world/furnaces";
import { RedstoneSim, setDoorOpen } from "./world/redstone";
import { Weather, rainHearing, rainLandsAt, snowShareAround, type WeatherKind } from "./world/weather";
import { FishingBobber } from "./entities/fishing";
import { raycast, type RayHit } from "./player/raycast";
import { SMELT_XP } from "./items/smelting";
import { runCommand, type CommandResult } from "./commands";
import { choosePlayer, cloudSave } from "./save/cloud";
import { blockIndex, CHUNK_SIZE } from "./config";
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
import { isCold } from "./world/terrain";
import { SPAWN_CONFIG } from "./entities/spawnConfig";
import { Spawner } from "./entities/spawner";
import type { Mob } from "./entities/mob";
import { MOB_LIST, MOB_TYPES, type MobType } from "./entities/mobTypes";
import { feed } from "./entities/animalLife";
import { TORCH_FX_RANGE, TorchParticles, hasFlame } from "./render/torchParticles";

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
  openFurnace(furnace: FurnaceState): void;
}

const isFurnace = (id: number) => id === B.FURNACE || id === B.FURNACE_LIT;
/** Items with a right-click action of their own (no "can't be placed" hint for these). */
const USABLE_ITEMS = new Set<number>([I.BUCKET, I.WATER_BUCKET, I.MILK_BUCKET, I.FISHING_ROD, I.SEEDS, I.REDSTONE, I.WOODEN_DOOR, I.IRON_DOOR, I.BOW]);
const usableBlock = (id: number) => id === B.CRAFTING_TABLE || isFurnace(id) || isLever(id) || isButton(id) || (isDoor(id) && !doorState(id).iron);

/** Block ids with a live flame, for fast chunk scans. */
const FLAME = new Uint8Array(256).map((_, id) => (hasFlame(id) ? 1 : 0));

/** Height below which the void hurts (64 blocks under the bottom of the world). */
export const VOID_DAMAGE_Y = -64;

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
  readonly redstone: RedstoneSim;
  readonly falling: FallingBlocks;
  readonly furnaces: FurnaceRegistry;
  readonly weather: Weather;
  private blockUpdates: BlockUpdates;
  /** Pressure plates held down, with seconds until they spring back once nothing stands on them. */
  private plates = new Map<string, number>();
  /** Wheat crops in loaded chunks, by chunk key. */
  private crops = new Map<string, Set<string>>();
  private cropTimer = 0;
  private ambientTimer = 0;
  private snowTimer = 0;
  /** 0 = rain, 1 = snow where the player is, eased so crossing a biome edge fades one into the other. */
  snowMix = 0;
  private snowTarget = -1;
  bobber: FishingBobber | null = null;
  /** Flames, smoke and sparks rising off nearby torches. */
  readonly torchFx = new TorchParticles();
  /** Torches with a live flame in loaded chunks, by chunk key. */
  private torches = new Map<string, Map<string, [number, number, number]>>();
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
    // The player (inventory, armor, XP, health, position) also lives in the cloud; a newer copy there wins.
    if (persist) meta.player = choosePlayer(meta, await cloudSave.pull(meta.id));
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
      bred: (baby) => this.events.emit("animalBred", { type: baby.type }),
      sound: (mob, sound) => {
        if (sound === "step") {
          const mx = Math.floor(mob.pos.x), mz = Math.floor(mob.pos.z);
          const feet = this.world.getBlock(mx, Math.floor(mob.pos.y + 0.01), mz);
          const under = feet === B.SNOW_LAYER ? feet : this.world.getBlock(mx, Math.floor(mob.pos.y - 0.2), mz);
          this.audio.blockAt(BLOCKS[under]?.sound ?? "none", "step", mob.pos.x, mob.pos.y, mob.pos.z);
        } else if (sound === "graze") {
          // Grazing is the grass block's own break sound, a little lower.
          this.audio.blockAt("grass", "break", mob.pos.x, mob.pos.y, mob.pos.z, 0.8);
          return;
        }
        this.audio.mobSound(mob.type, sound, mob.pos.x, mob.pos.y + mob.height * 0.8, mob.pos.z, mob.baby);
      },
    });
    this.group.add(this.entities.group, this.projectiles.group, this.xpOrbs.group);
    this.spawner = new Spawner(this.world, this.entities);
    this.world.onChunkLoaded = (chunk) => {
      this.chunkEntitiesIn(chunk.cx, chunk.cz, (x, y, z) => chunk.get(x, y, z));
      this.scanCrops(chunk);
    };
    this.world.onChunkUnloaded = (chunk) => {
      this.chunkEntitiesOut(chunk.cx, chunk.cz);
      this.crops.delete(`${chunk.cx},${chunk.cz}`);
      this.torches.delete(`${chunk.cx},${chunk.cz}`);
    };
    this.fluid = new FluidSimulator(this.world);
    this.redstone = new RedstoneSim(this.world);
    this.weather = new Weather(meta.weather);
    this.falling = new FallingBlocks(this.world, materials.entity, (id, x, y, z) => {
      if (this.player.mode === "survival") this.drops.spawn(id, 1, x, y, z);
    });
    this.furnaces = new FurnaceRegistry(meta.furnaces, (x, y, z, lit) => {
      if (isFurnace(this.world.getBlock(x, y, z))) this.world.setBlock(x, y, z, lit ? B.FURNACE_LIT : B.FURNACE);
    });
    // Every block change runs through here: things hanging on the block pop
    // off, then water, redstone and falling sand get their wake-up call.
    this.blockUpdates = new BlockUpdates(this.world, {
      popped: (x, y, z, id) => {
        if (this.player.mode !== "survival") return;
        for (const d of blockDrops(id)) this.drops.spawn(d.id, d.count, x + 0.5, y + 0.3, z + 0.5);
      },
      changed: (x, y, z, before, after) => {
        this.fluid.notify(x, y, z);
        this.redstone.notify(x, y, z);
        this.falling.check(x, y + 1, z);
        this.falling.check(x, y, z);
        if (isFurnace(before) && !isFurnace(after)) {
          for (const st of this.furnaces.remove(x, y, z)) this.drops.spawn(st.id, st.count, x + 0.5, y + 0.5, z + 0.5);
        }
        if (isWheat(after)) this.cropSet(x, z).add(`${x},${y},${z}`);
        if (hasFlame(after)) this.torchSet(x, z).set(`${x},${y},${z}`, [x, y, z]);
        // A door's lower half swinging (by hand or by redstone).
        if (isDoor(before) && isDoor(after) && !doorState(after).upper && doorState(before).open !== doorState(after).open) {
          this.audio.door(doorState(after).open, x + 0.5, y + 1, z + 0.5);
        }
      },
    });
    this.world.onBlockChange = (x, y, z, before, after) => this.blockUpdates.onChange(x, y, z, before, after);
    this.fluid.onWashedAway = (x, y, z, id) => {
      const drop = BLOCKS[id]?.drop;
      if (drop !== null && drop !== undefined && this.player.mode === "survival") this.drops.spawn(drop, 1, x + 0.5, y + 0.3, z + 0.5);
    };
    this.group.add(this.world.group, this.drops.group, this.selection.group, this.falling.group, this.torchFx.group);

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
      useEntity: (target) => this.feedAnimal(target as Mob),
      heldItem: () => this.inventory.held?.id ?? 0,
      consumeHeld: () => this.inventory.removeFromSlot(this.inventory.selected, 1),
      onBlockBroken: (x, y, z, id, harvested) => {
        this.playAt(BLOCKS[id].sound, "break", x, y, z);
        const tool = this.inventory.held?.id ?? 0;
        this.events.emit("blockBroken", { id, x, y, z, harvested, tool });
        if (this.player.mode === "survival") {
          this.vitals.exhaust(0.005);
          const xp = harvested ? blockXp(id) : 0;
          if (xp > 0) this.xpOrbs.spawn(xp, x + 0.5, y + 0.5, z + 0.5);
          if (BLOCKS[id].hardness > 0) this.wearHeld(wearFor(tool, "block"));
          // Ice over anything but air melts into water when broken.
          if (id === B.ICE && this.world.getBlock(x, y - 1, z) !== B.AIR) this.world.setBlock(x, y, z, B.WATER);
        }
        if (!harvested) return;
        for (const d of blockDrops(id)) this.drops.spawn(d.id, d.count, x + 0.5, y + 0.4, z + 0.5);
      },
      onBlockPlaced: (x, y, z, id) => {
        this.playAt(BLOCKS[id].sound, "place", x, y, z);
        // Count a wall torch as a torch (and a lever state as a lever) for achievements.
        const placed = getItem(id) ? id : BLOCKS[id]?.drop ?? id;
        this.events.emit("blockPlaced", { id: placed, x, y, z });
      },
      onUseBlock: (x, y, z, id) => this.useBlock(x, y, z, id),
      useItem: (hit) => this.useItem(hit),
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
    this.audio.bowShot(from, 5 / 6 + Math.random() * (1.25 - 5 / 6));
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

  /** A block sound from the middle of block (x, y, z), placed by the 16-block hearing rules. */
  private playAt(kind: Parameters<Audio["block"]>[0], action: Parameters<Audio["block"]>[1], x: number, y: number, z: number) {
    this.audio.blockAt(kind, action, x + 0.5, y + 0.5, z + 0.5);
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
    // Block states without an item of their own (wall torches, lit furnaces...) pick their item.
    const id = t ? (getItem(t.id) ? t.id : BLOCKS[t.id]?.drop ?? null) : null;
    if (id === null || !getItem(id)) return;
    const slots = this.inventory.slots;
    const existing = slots.findIndex((s, i) => i < HOTBAR_SIZE && s?.id === id);
    if (existing >= 0) this.inventory.selected = existing;
    else if (this.player.mode === "creative") slots[this.inventory.selected] = { id, count: 64 };
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
          const usable = !!held && (USABLE_ITEMS.has(held.id) || heldItem?.tool?.type === "hoe");
          if (input.clicked.has(2) && this.interaction.target && !usableBlock(this.interaction.target.id) && !heldItem?.block && !heldItem?.food && !usable) {
            this.hint(
              held ? "place-item" : "place-empty",
              held ? "That item can't be placed - pick a block in your hotbar" : "Nothing to place - mine blocks to collect them, or use Creative",
            );
          }
        }
      }
      const alive = !this.vitals.dead;
      p.update(dt, input, controls && alive);
      const ears = p.eye();
      this.audio.setListener(ears.x, ears.y, ears.z, p.yaw);
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
        target: targetable ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : null,
        hurtTarget: (mob, amount) => this.hurtPlayer(amount, "mob", mob.pos.x, mob.pos.z),
        holder: alive && this.inventory.held ? { x: p.pos.x, y: p.pos.y, z: p.pos.z, item: this.inventory.held.id } : null,
        // Overcast skies keep the undead from burning.
        isDay: this.daylight > 0.75 && !this.weather.raining,
      });
      if (this.mobRules.mobs) this.projectiles.update(dt, this.entities.solidAt, {
        player: () => (alive ? { x: p.pos.x, y: p.pos.y, z: p.pos.z, half: p.half, height: p.height } : null),
        hitPlayer: (damage, from) => this.hurtPlayer(damage, "arrow", from.x, from.z),
        mobs: () => this.entities.mobs.values(),
        hitMob: (mob, damage, from) => {
          mob.hurt(damage, { weapon: I.BOW, from: { x: from.x, z: from.z } });
        },
        pickup: () => {
          if (p.mode === "creative") return true;
          const left = this.inventory.add(I.ARROW, 1);
          if (left === 0) this.audio.pickup();
          return left === 0;
        },
        thud: (x, y, z) => this.audio.arrowHit(x, y, z),
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
        skyDim: Math.round(this.weather.rain * 3 + this.weather.thunder * 5),
      });

      this.redstone.tick(dt);
      this.falling.update(dt);
      this.furnaces.tick(dt, (x, y, z) => (this.world.isLoaded(x, z) ? this.world.getBlock(x, y, z) : null), (out) => SMELT_XP[out] ?? 0);
      this.updatePlates(dt, alive);
      this.updateCrops(dt);
      this.updateFishing(dt);
      if (this.weather.update(dt)) this.onLightning?.();
      this.updateSnowfall(dt);
      this.torchFx.update(dt, p.eye(), this.nearbyTorches());
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 0.25;
        // Snow or rain is decided where you stand, for all the weather around you.
        const target = snowShareAround(p.pos.x, p.pos.z, (x, z) => isColdAt(this, x, z)) >= 0.5 ? 1 : 0;
        if (this.snowTarget < 0) this.snowMix = target;
        this.snowTarget = target;
        const rain = this.weather.rain * (1 - this.snowMix);
        if (rain < 0.01) {
          this.audio.setRain(0);
        } else {
          // Heard from where it lands nearby: fades as you dig down, muffled under a roof.
          const heard = rainHearing(p.eye(), (x, z) => rainLandsAt(this.world, x, z));
          this.audio.setRain(rain * heard.volume, heard.covered);
        }
      }
      if (this.snowTarget >= 0) this.snowMix += (this.snowTarget - this.snowMix) * (1 - Math.exp(-dt / 0.8));

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
      this.updateVoid(dt);
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

    // Eating: hold right click with food for 1.6 s.
    const held = this.inventory.held;
    const heldDef = held ? getItem(held.id) : undefined;
    const food = heldDef?.food;
    const drink = heldDef?.drink;
    if (controls && ((food && this.vitals.food < 20) || drink) && input.buttons.has(2)) {
      this.eating += dt / 1.6;
      this.eatSoundTimer -= dt;
      if (this.eatSoundTimer <= 0) {
        if (drink) this.audio.drink();
        else this.audio.eat();
        this.eatSoundTimer = drink ? 0.5 : 0.22;
      }
      if (this.eating >= 1) {
        if (food) this.vitals.eat(food.hunger, food.saturation);
        this.events.emit("itemEaten", { id: held!.id });
        if (drink) this.swapHeld(drink.leaves);
        else this.inventory.removeFromSlot(this.inventory.selected, 1);
        if (!drink) this.audio.burp();
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

  /* ------------------------------------------------------------ using blocks and items */

  /** Right-click on a block that does something. */
  private useBlock(x: number, y: number, z: number, id: number): boolean {
    const w = this.world;
    if (id === B.CRAFTING_TABLE) {
      this.hooks.openCrafting();
      return true;
    }
    if (isFurnace(id)) {
      this.hooks.openFurnace(this.furnaces.get(x, y, z));
      return true;
    }
    if (isLever(id)) {
      const on = !switchOn(id);
      w.setBlock(x, y, z, leverBlock(switchFace(id), on));
      this.audio.switchClick(on, x + 0.5, y + 0.5, z + 0.5);
      this.onSwing?.();
      return true;
    }
    if (isButton(id)) {
      if (switchOn(id)) return true;
      const face = switchFace(id);
      w.setBlock(x, y, z, buttonBlock(face, true));
      this.audio.switchClick(true, x + 0.5, y + 0.5, z + 0.5);
      this.onSwing?.();
      // Stone buttons spring back after a second.
      this.redstone.schedule(`button:${x},${y},${z}`, 1, () => {
        if (w.getBlock(x, y, z) === buttonBlock(face, true)) {
          w.setBlock(x, y, z, buttonBlock(face, false));
          this.audio.switchClick(false, x + 0.5, y + 0.5, z + 0.5);
        }
      });
      return true;
    }
    if (isDoor(id)) {
      const s = doorState(id);
      // Iron doors only open with redstone.
      if (s.iron) return true;
      setDoorOpen(w, x, s.upper ? y - 1 : y, z, !s.open);
      this.onSwing?.();
      return true;
    }
    return false;
  }

  /** Right-click an animal with the food it breeds with: love (or growing up faster for babies). */
  private feedAnimal(mob: Mob): boolean {
    const held = this.inventory.held;
    if (held?.id === I.BUCKET && mob.type === "cow" && !mob.baby && !mob.dead) {
      this.audio.mobSound("cow", "milk", mob.pos.x, mob.pos.y + mob.height * 0.5, mob.pos.z);
      if (this.player.mode === "survival") this.swapHeld(I.MILK_BUCKET);
      else this.inventory.add(I.MILK_BUCKET, 1);
      this.onSwing?.();
      return true;
    }
    if (!held || !mob.def?.breedFood?.includes(held.id) || mob.dead) return false;
    if (feed(mob, SPAWN_CONFIG.growUpSeconds) === "refused") return false;
    if (mob.baby && mob.age >= SPAWN_CONFIG.growUpSeconds) mob.growUp();
    this.audio.mobSound(mob.type, "eat", mob.pos.x, mob.pos.y + mob.height * 0.7, mob.pos.z, mob.baby);
    if (this.player.mode === "survival") this.inventory.removeFromSlot(this.inventory.selected, 1);
    this.events.emit("animalFed", { type: mob.type });
    this.onSwing?.();
    return true;
  }

  /** Hoes, buckets and fishing rods; returns true if the click was used. */
  private useItem(hit: RayHit | null): boolean {
    const held = this.inventory.held;
    if (!held) return false;
    const survival = this.player.mode === "survival";
    const w = this.world;
    if (getItem(held.id)?.tool?.type === "hoe") {
      if (!hit || (hit.id !== B.GRASS && hit.id !== B.DIRT && hit.id !== B.SNOWY_GRASS) || hit.ny === -1) return false;
      if (w.getBlock(hit.x, hit.y + 1, hit.z) !== B.AIR) return false;
      w.setBlock(hit.x, hit.y, hit.z, B.FARMLAND);
      this.playAt("grass", "place", hit.x, hit.y, hit.z);
      this.wearHeld(1);
      this.onSwing?.();
      return true;
    }
    if (held.id === I.BUCKET) {
      const water = raycast(w, this.player.eye(), this.player.look(), this.interaction.reach, true);
      if (!water || water.id !== B.WATER) return false;
      w.setBlock(water.x, water.y, water.z, B.AIR);
      this.audio.splash({ x: water.x + 0.5, y: water.y + 0.5, z: water.z + 0.5 });
      if (survival) this.swapHeld(I.WATER_BUCKET);
      this.events.emit("itemPickedUp", { id: I.WATER_BUCKET, count: 1 });
      this.onSwing?.();
      return true;
    }
    if (held.id === I.WATER_BUCKET) {
      if (!hit) return false;
      const into = BLOCKS[hit.id]?.replaceable && !isWater(hit.id);
      const x = into ? hit.x : hit.x + hit.nx;
      const y = into ? hit.y : hit.y + hit.ny;
      const z = into ? hit.z : hit.z + hit.nz;
      const cur = w.getBlock(x, y, z);
      if (cur === B.WATER || (!BLOCKS[cur]?.replaceable && !isWater(cur))) return false;
      if (cur !== B.AIR && !isWater(cur) && survival) for (const d of blockDrops(cur)) this.drops.spawn(d.id, d.count, x + 0.5, y + 0.3, z + 0.5);
      if (!w.setBlock(x, y, z, B.WATER)) return false;
      this.audio.splash({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      if (survival) this.swapHeld(I.BUCKET);
      this.onSwing?.();
      return true;
    }
    if (held.id === I.FISHING_ROD) {
      this.useRod();
      return true;
    }
    return false;
  }

  /** Turns one of the held items into `id` (filling or emptying a bucket). */
  private swapHeld(id: number) {
    const slot = this.inventory.selected;
    const held = this.inventory.slots[slot];
    if (!held) return;
    if (held.count <= 1) {
      this.inventory.slots[slot] = { id, count: 1 };
    } else {
      held.count--;
      const left = this.inventory.add(id, 1);
      if (left > 0) this.throwStack({ id, count: left });
    }
    this.inventory.changed();
  }

  private rodTip() {
    const eye = this.player.eye();
    const look = this.player.look();
    const right = new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw));
    return eye.addScaledVector(look, 0.7).addScaledVector(right, 0.35).add(new THREE.Vector3(0, -0.15, 0));
  }

  /** Cast the line, or reel it in (catching a fish if one is biting). */
  private useRod() {
    this.onSwing?.();
    if (!this.bobber) {
      const b = new FishingBobber(this.rodTip(), this.player.look(), this.weather.raining);
      b.onBite = () => this.audio.bobber(true, b.pos.x, b.pos.y, b.pos.z);
      b.onSplash = () => this.audio.bobber(false, b.pos.x, b.pos.y, b.pos.z);
      this.bobber = b;
      this.group.add(b.group);
      this.audio.bowShot();
      return;
    }
    const result = this.bobber.reel();
    const p = this.player;
    if (result === "fish") {
      this.drops.spawn(I.RAW_FISH, 1, p.pos.x, p.pos.y + 1, p.pos.z, new THREE.Vector3(0, 1, 0), 0);
      if (p.mode === "survival") this.xpOrbs.spawn(1 + Math.floor(Math.random() * 6), p.pos.x, p.pos.y + 0.5, p.pos.z);
      this.audio.splash();
      this.wearHeld(1);
    } else if (result === "snagged") {
      this.wearHeld(2);
    }
    this.removeBobber();
  }

  private removeBobber() {
    if (!this.bobber) return;
    this.group.remove(this.bobber.group);
    this.bobber.dispose();
    this.bobber = null;
  }

  private updateFishing(dt: number) {
    if (!this.bobber) return;
    if (this.inventory.held?.id !== I.FISHING_ROD || this.vitals.dead) return this.removeBobber();
    if (!this.bobber.update(dt, this.world, this.rodTip())) this.removeBobber();
  }

  /* ------------------------------------------------------------ redstone, crops, furnaces */

  /** Stone pressure plates go down under a player or mob and spring back a second after they leave. */
  private updatePlates(dt: number, playerAlive: boolean) {
    const w = this.world;
    const pressed = new Set<string>();
    const feet = (x: number, y: number, z: number) => {
      const bx = Math.floor(x), by = Math.floor(y + 0.05), bz = Math.floor(z);
      if (isPlate(w.getBlock(bx, by, bz))) pressed.add(`${bx},${by},${bz}`);
    };
    if (playerAlive) feet(this.player.pos.x, this.player.pos.y, this.player.pos.z);
    if (this.mobRules.mobs) for (const m of this.entities.mobs.values()) if (!m.dead) feet(m.pos.x, m.pos.y, m.pos.z);
    for (const k of pressed) {
      const [x, y, z] = k.split(",").map(Number);
      if (w.getBlock(x, y, z) === B.PRESSURE_PLATE) {
        w.setBlock(x, y, z, B.PRESSURE_PLATE_ON);
        this.audio.switchClick(true, x + 0.5, y + 0.1, z + 0.5);
      }
      this.plates.set(k, 1);
    }
    for (const [k, t] of this.plates) {
      if (pressed.has(k)) continue;
      if (t - dt > 0) {
        this.plates.set(k, t - dt);
        continue;
      }
      this.plates.delete(k);
      const [x, y, z] = k.split(",").map(Number);
      if (w.getBlock(x, y, z) === B.PRESSURE_PLATE_ON) {
        w.setBlock(x, y, z, B.PRESSURE_PLATE);
        this.audio.switchClick(false, x + 0.5, y + 0.1, z + 0.5);
      }
    }
  }

  /**
   * While it snows, snow settles on open ground in cold places and still
   * water there freezes over, a few random columns per nearby chunk each
   * second, so the land turns white over a few minutes.
   */
  private updateSnowfall(dt: number) {
    if (!this.weather.raining || this.weather.rain < 0.5) return;
    this.snowTimer += dt;
    if (this.snowTimer < 1) return;
    this.snowTimer -= 1;
    const w = this.world;
    const pcx = Math.floor(this.player.pos.x / CHUNK_SIZE), pcz = Math.floor(this.player.pos.z / CHUNK_SIZE);
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (!w.chunkAt(pcx + dx, pcz + dz) || Math.random() > 0.35) continue;
        for (let k = 0; k < 4; k++) {
          const x = (pcx + dx) * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
          const z = (pcz + dz) * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
          if (!isColdAt(this, x, z)) continue;
          const top = rainLandsAt(w, x, z);
          if (top <= 0 || top >= CHUNK_HEIGHT) continue;
          const below = w.getBlock(x, top - 1, z);
          if (below === B.WATER) w.setBlock(x, top - 1, z, B.ICE);
          else if (w.getBlock(x, top, z) === B.AIR && supports(B.SNOW_LAYER, below)) w.setBlock(x, top, z, B.SNOW_LAYER);
        }
      }
    }
  }

  private cropSet(x: number, z: number) {
    const key = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
    let set = this.crops.get(key);
    if (!set) this.crops.set(key, (set = new Set()));
    return set;
  }

  private torchSet(x: number, z: number) {
    const key = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
    let set = this.torches.get(key);
    if (!set) this.torches.set(key, (set = new Map()));
    return set;
  }

  /** A chunk came in: note its crops (they grow) and torches (they smoke). */
  private scanCrops(chunk: Chunk) {
    const b = chunk.blocks;
    for (let i = 0; i < b.length; i++) {
      const id = b[i];
      const crop = id >= B.WHEAT_0 && id <= B.WHEAT_7;
      if (!crop && !FLAME[id]) continue;
      const x = i % CHUNK_SIZE;
      const z = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
      const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
      if (blockIndex(x, y, z) !== i) continue;
      const wx = chunk.cx * CHUNK_SIZE + x, wz = chunk.cz * CHUNK_SIZE + z;
      if (crop) this.cropSet(wx, wz).add(`${wx},${y},${wz}`);
      else this.torchSet(wx, wz).set(`${wx},${y},${wz}`, [wx, y, wz]);
    }
  }

  /** Torches near the player that still have a flame (gone ones are forgotten). */
  private *nearbyTorches(): Generator<[number, number, number, number]> {
    const p = this.player.pos;
    const r = Math.ceil(TORCH_FX_RANGE / CHUNK_SIZE);
    const pcx = Math.floor(p.x / CHUNK_SIZE), pcz = Math.floor(p.z / CHUNK_SIZE);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const set = this.torches.get(`${pcx + dx},${pcz + dz}`);
      if (!set) continue;
      for (const [k, [x, y, z]] of set) {
        const id = this.world.getBlock(x, y, z);
        if (!hasFlame(id)) {
          set.delete(k);
          continue;
        }
        yield [x, y, z, id];
      }
    }
  }

  /** Wheat grows a stage every half minute or so, faster with water nearby. */
  private updateCrops(dt: number) {
    this.cropTimer += dt;
    if (this.cropTimer < 1) return;
    this.cropTimer -= 1;
    const w = this.world;
    for (const set of this.crops.values()) {
      for (const k of set) {
        const [x, y, z] = k.split(",").map(Number);
        const id = w.getBlock(x, y, z);
        if (!isWheat(id) || id === B.WHEAT_7) {
          set.delete(k);
          continue;
        }
        // Needs some light to grow.
        const light = w.getLight(x, y, z);
        if (Math.max(light >> 4, light & 15) < 9) continue;
        const chance = this.nearWater(x, y - 1, z) ? 1 / 25 : 1 / 50;
        if (Math.random() < chance) w.setBlock(x, y, z, id + 1);
      }
    }
  }

  private nearWater(x: number, y: number, z: number) {
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (isWater(this.world.getBlock(x + dx, y, z + dz))) return true;
    return false;
  }

  /** The furnace screen hands over its output: bank the smelting XP and count it toward achievements. */
  takeSmelted(furnace: FurnaceState, stack: ItemStack) {
    const whole = Math.floor(furnace.xp);
    const xp = whole + (Math.random() < furnace.xp - whole ? 1 : 0);
    furnace.xp = 0;
    const p = this.player;
    if (xp > 0 && p.mode === "survival") this.xpOrbs.spawn(xp, p.pos.x, p.pos.y + 0.5, p.pos.z);
    this.events.emit("itemCrafted", { id: stack.id, count: stack.count });
  }

  /* ------------------------------------------------------------ console */

  get cheats() {
    return this.meta.cheats ?? true;
  }

  /** Runs a chat command such as "/time set night". */
  command(text: string): CommandResult {
    const session = this;
    const p = this.player;
    return runCommand(text, {
      cheats: this.cheats,
      playerPos: () => ({ x: p.pos.x, y: p.pos.y, z: p.pos.z }),
      setMode: (mode) => this.setMode(mode),
      get time() {
        return session.time;
      },
      set time(v: number) {
        session.time = v;
      },
      setWeather: (kind: WeatherKind, seconds?: number) => this.weather.set(kind, seconds),
      give: (id, count) => {
        const left = this.inventory.add(id, count);
        if (left > 0) this.throwStack({ id, count: left });
        if (left < count) {
          this.audio.pickup();
          this.events.emit("itemPickedUp", { id, count: count - left });
        }
        return left;
      },
      teleport: (x, y, z) => {
        p.vel.set(0, 0, 0);
        p.teleport(x, y, z);
        this.spawnPending = { x, z, y };
      },
      setSpawn: (x, y, z) => {
        this.meta.spawnPoint = [x, y, z];
      },
      kill: () => this.vitals.damage(1e9, "kill"),
    });
  }

  /** Called when lightning strikes (for the flash and thunder). */
  onLightning: (() => void) | null = null;

  /**
   * Below the bedrock there is nothing to land on. Like the classic game,
   * the void only starts hurting 64 blocks under the bottom of the world, so
   * you fall for a few seconds first, then take 4 damage every half second.
   * It catches Creative players too.
   */
  private updateVoid(dt: number) {
    if (this.player.pos.y >= VOID_DAMAGE_Y || this.vitals.dead) {
      this.voidTimer = 0;
      return;
    }
    this.voidTimer -= dt;
    if (this.voidTimer > 0) return;
    this.voidTimer = 0.5;
    this.vitals.damage(4, "void");
  }

  /** Back to the world spawn with full health and an empty inventory. */
  respawn() {
    this.vitals.reset();
    this.deathHandled = false;
    this.eating = 0;
    const sp = this.meta.spawnPoint;
    const spawn = sp ? { x: sp[0] + 0.5, y: sp[1], z: sp[2] + 0.5 } : this.world.generator.findSpawn();
    this.player.vel.set(0, 0, 0);
    this.player.flying = false;
    this.spawnPending = { x: spawn.x, z: spawn.z, y: sp ? sp[1] : null };
    this.player.teleport(spawn.x, spawn.y + (sp ? 0 : 1), spawn.z);
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
      furnaces: this.furnaces.serialize(),
      weather: this.weather.serialize(),
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

  /**
   * Writes edited chunks and the player/world metadata, then uploads the
   * player to the cloud (`cloudNow` false lets frequent autosaves be throttled).
   * Concurrent calls share one save.
   */
  save(thumbnail?: string, cloudNow = true): Promise<void> {
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
        void cloudSave.push(meta, cloudNow);
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
    this.redstone.clear();
    this.falling.clear();
    this.torchFx.clear();
    this.removeBobber();
    this.entities.clear();
    this.projectiles.clear();
    this.xpOrbs.clear();
    this.drops.clear();
    this.world.dispose();
  }
}

/** Snow instead of rain at this column? */
export function isColdAt(session: Session, x: number, z: number) {
  return isCold(session.world.generator.column(x, z));
}
