import * as THREE from "three";
import { Audio } from "./audio/audio";
import { CHUNK_SIZE, DAY_TICKS, GAME_NAME, GAME_VERSION } from "./config";
import { Input } from "./input/input";
import { WorkerPool } from "./mesher/pool";
import { seedFromString } from "./noise";
import type { GameMode } from "./player/player";
import { createBlockMaterials, createWorldUniforms, type BlockMaterials, type WorldUniforms } from "./render/materials";
import { Sky } from "./render/sky";
import { getTextures } from "./render/textures";
import { ViewModel } from "./render/viewmodel";
import { deleteWorld, listWorlds, newWorldId, putWorld, type WorldMeta } from "./save/db";
import { Session } from "./session";
import { GuestNet } from "./net/guest";
import { HostNet } from "./net/host";
import { cleanName } from "./net/protocol";
import { cloudSave } from "./save/cloud";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { installUiTextures, setClickSound, updateGuiScale, h } from "./ui/dom";
import { Hud } from "./ui/hud";
import { InventoryScreen, type ContainerMode } from "./ui/inventoryScreen";
import { Menus } from "./ui/menus";
import { BLOCKS, B, getItem } from "./world/blocks";
import { Chat } from "./ui/chat";
import { WeatherRenderer } from "./render/weather";
import { rainLandsAt } from "./world/weather";
import type { FurnaceState } from "./world/furnaces";
import { itemIcon } from "./render/items";
import { internalSkyLight } from "./entities/spawnRules";
import { bowPower } from "./items/combat";
import { BIOME_NAMES, isCold } from "./world/terrain";
import { World } from "./world/world";

type State = "title" | "loading" | "playing" | "paused" | "container" | "chat" | "saving" | "dead";

const DEATH_MESSAGES: Record<string, string> = {
  fall: "You hit the ground too hard",
  drown: "You drowned",
  starve: "You starved to death",
  void: "You fell out of the world",
  mob: "You were overwhelmed in the dark",
  arrow: "You were shot by a Rattler",
  kill: "You were struck down by a command",
};

const PANORAMA_SEED = 20240611;
const FACING = ["north", "west", "south", "east"];
const FACING_AXIS = ["Towards negative Z", "Towards negative X", "Towards positive Z", "Towards positive X"];

/** Owns the renderer, the UI layers and the state machine around an open world. */
export class Game {
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
  readonly input: Input;
  readonly audio = new Audio();
  readonly settings: Settings = loadSettings();
  readonly hud = new Hud();
  readonly menus: Menus;
  readonly containers: InventoryScreen;
  readonly sky = new Sky();
  readonly viewModel: ViewModel;
  readonly chat = new Chat();
  private weatherFx: WeatherRenderer | null = null;
  readonly embedded = window.parent !== window;
  session: Session | null = null;
  state: State = "title";

  private pool: WorkerPool;
  private uniforms: WorldUniforms;
  private materials: BlockMaterials;
  private panorama: World | null = null;
  private panoramaOrigin = new THREE.Vector3();
  private last = performance.now();
  private elapsed = 0;
  private fps = 60;
  private fpsFrames = 0;
  private fpsTime = 0;
  private showDebug = false;
  private hideHud = false;
  private expectUnlock = false;
  private fovCurrent = 70;
  private wantThumbnail: ((url: string) => void) | null = null;
  private loadingStarted = 0;
  private frameStats = { calls: 0, triangles: 0 };
  /** When the pause menu opened; some browsers deliver the Esc keydown right after releasing the lock. */
  private pausedAt = 0;
  /** Smoothed time the game itself spends per frame (excludes waiting for the display). */
  private cpuMs = 0;

  constructor(mount: HTMLElement) {
    this.root = h("div.bv-root");
    mount.append(this.root);
    this.canvas = h("canvas.bv-world");
    this.root.append(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.info.autoReset = false;

    const textures = getTextures();
    this.uniforms = createWorldUniforms(textures.arrayTexture);
    this.materials = createBlockMaterials(this.uniforms);
    this.pool = new WorkerPool(Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)));
    this.viewModel = new ViewModel(this.materials.entity);
    this.scene.add(this.sky.group, this.sky.clouds);
    this.scene.fog = new THREE.Fog(0xffffff, 60, 120);

    installUiTextures(this.root);
    updateGuiScale(this.root);
    setClickSound(() => this.audio.click());

    this.menus = new Menus({
      settings: this.settings,
      embedded: this.embedded,
      applySettings: () => this.applySettings(),
      listWorlds,
      createWorld: (name, seedText, mode, cheats) => void this.createWorld(name, seedText, mode, cheats),
      playWorld: (meta) => void this.startSession(meta),
      deleteWorld: async (id) => {
        await deleteWorld(id);
        void cloudSave.remove(id);
      },
      cloudStatus: () => cloudSave.describe(),
      quitGame: () => this.quit(),
      resume: () => this.resume(),
      saveAndQuit: () => void this.saveAndQuit(),
      gameMode: () => this.session?.mode ?? null,
      respawn: () => this.respawn(),
      currentAchievements: () =>
        this.session ? { state: this.session.achievements.state, worldName: this.session.meta.name } : null,
      playerName: () => this.settings.playerName,
      setPlayerName: (name) => {
        this.settings.playerName = cleanName(name);
        saveSettings(this.settings);
      },
      joinWorld: (code, name) => this.joinWorld(code, name),
      multiplayer: () => {
        const net = this.session?.net;
        if (net instanceof HostNet) return { role: "host", code: net.code, players: net.playerCount, names: net.names };
        if (net instanceof GuestNet) return { role: "guest", code: net.code };
        return { role: "solo" };
      },
      openToFriends: () => this.openToFriends(),
      leaveWorld: () => this.leaveToTitle(),
      setGameMode: (mode) => {
        this.session?.setMode(mode);
        this.hud.showHint(mode === "creative" ? "Creative: double-tap Space to fly, E for all blocks" : "Survival: mine and craft to get blocks");
      },
    });
    const game = this;
    this.containers = new InventoryScreen({
      get inventory() {
        return game.session!.inventory;
      },
      dropStack: (stack) => this.session?.throwStack(stack),
      onCraft: (result) => {
        this.audio.craft();
        this.session?.crafted(result.id, result.count);
      },
      onSlotClick: () => {},
      onSmeltTake: (furnace, taken) => this.session?.takeSmelted(furnace, taken),
    });
    this.chat.onSubmit = (text) => this.submitChat(text);
    this.chat.onClose = () => this.closeChat();
    this.root.append(this.hud.el, this.chat.el, this.containers.el, this.menus.el);
    this.hud.visible = false;

    this.input = new Input(this.canvas);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    this.input.onLockError = () => {
      if (this.state === "playing") this.hud.showClickToPlay = true;
    };
    this.canvas.addEventListener("mousedown", () => {
      if (this.state === "playing" && !this.input.locked) this.input.requestLock();
    });
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("pointerdown", () => this.post({ type: "blockvale:focus" }), true);
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("message", (e) => this.onMessage(e));
    document.addEventListener("visibilitychange", () => {
      this.updateBackgroundTicker();
      if (document.visibilityState === "hidden") void this.session?.save().catch(() => {});
    });
    window.addEventListener("pagehide", () => void this.session?.save().catch(() => {}));
    this.resize();
    this.applySettings();
  }

  start() {
    this.showTitle();
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const t0 = performance.now();
      this.frame(dt);
      this.cpuMs = this.cpuMs * 0.95 + (performance.now() - t0) * 0.05;
    };
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- setup */

  private resize() {
    const w = Math.max(1, this.root.clientWidth || window.innerWidth);
    const hgt = Math.max(1, this.root.clientHeight || window.innerHeight);
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.viewModel.resize(w / hgt);
    updateGuiScale(this.root);
  }

  private applySettings() {
    const s = this.settings;
    saveSettings(s);
    this.audio.setVolumes(s.masterVolume, s.musicVolume);
    this.audio.setMusicEnabled(s.musicVolume > 0);
    if (this.session) this.session.mobRules = { mobs: s.mobs, peaceful: s.difficulty === "peaceful" };
  }

  private post(msg: Record<string, unknown>) {
    if (this.embedded) window.parent.postMessage(msg, window.location.origin);
  }

  private onMessage(e: MessageEvent) {
    if (e.origin !== window.location.origin || typeof e.data !== "object" || !e.data) return;
    if (e.data.type === "blockvale:pause" && (this.state === "playing" || this.state === "container" || this.state === "chat")) {
      if (this.state === "container") this.closeContainer(false);
      if (this.state === "chat") {
        this.chat.onClose = null;
        this.chat.close();
        this.chat.onClose = () => this.closeChat();
        this.state = "playing";
      }
      this.pause();
    } else if (e.data.type === "blockvale:request-save") {
      const reply = () => this.post({ type: "blockvale:saved" });
      if (this.session) void this.session.save().then(reply, reply);
      else reply();
    }
  }

  private quit() {
    if (this.embedded) this.post({ type: "blockvale:close" });
    else window.location.href = "/";
  }

  /* ---------------------------------------------------------------- title */

  private showTitle() {
    this.state = "title";
    this.hud.visible = false;
    this.canvas.classList.add("is-blurred");
    if (!this.panorama) {
      this.panorama = new World(PANORAMA_SEED, this.pool, this.materials, null);
      this.panorama.renderDistance = Math.min(6, this.settings.renderDistance);
      const spawn = this.panorama.generator.findSpawn();
      let top = 0;
      for (let dz = -24; dz <= 24; dz += 4) {
        for (let dx = -24; dx <= 24; dx += 4) top = Math.max(top, this.panorama.generator.column(spawn.x + dx, spawn.z + dz).height);
      }
      this.panoramaOrigin.set(spawn.x, top + 6, spawn.z);
      this.scene.add(this.panorama.group);
    }
    this.menus.showTitle();
  }

  private disposePanorama() {
    if (!this.panorama) return;
    this.scene.remove(this.panorama.group);
    this.panorama.dispose();
    this.panorama = null;
  }

  /* ---------------------------------------------------------------- worlds */

  private async createWorld(name: string, seedText: string, mode: GameMode, cheats: boolean) {
    const seed = seedText.trim() ? seedFromString(seedText) : (Math.random() * 2 ** 31) | 0;
    const now = Date.now();
    const meta: WorldMeta = {
      id: newWorldId(),
      name,
      seed,
      seedText: seedText.trim() || String(seed),
      mode,
      created: now,
      lastPlayed: now,
      time: 1000,
      player: null,
      cheats,
    };
    await putWorld(meta).catch(() => {});
    await this.startSession(meta);
  }

  private async startSession(meta: WorldMeta, guest: GuestNet | null = null) {
    this.state = "loading";
    this.menus.showLoading("Loading world", 0);
    const session = await Session.open(meta, this.pool, this.materials, this.audio, {
      openCrafting: () => this.openContainer("crafting"),
      openFurnace: (furnace) => this.openContainer("furnace", furnace),
    }, !guest, guest);
    if (guest) this.wireNet(guest);
    this.disposePanorama();
    this.session = session;
    session.onSwing = () => this.viewModel.startSwing();
    session.onHint = (text) => this.hud.showHint(text);
    session.xp.onLevelUp = () => this.audio.levelUp();
    session.mobRules = { mobs: this.settings.mobs, peaceful: this.settings.difficulty === "peaceful" };
    session.onAchievement = (def) => {
      this.hud.showAchievement(def.title, "item" in def.icon ? itemIcon(def.icon.item) : itemIcon(B.WATER_FLOW_3), !!def.challenge);
      this.audio.achievement(!!def.challenge);
    };
    session.onLightning = () => {
      // Thunder follows the flash after a moment, like a strike some way off.
      const distance = Math.random();
      setTimeout(() => this.audio.thunder(distance), 150 + distance * 1800);
    };
    this.scene.add(session.group);
    this.weatherFx = new WeatherRenderer({
      topAt: (x, z) => rainLandsAt(session.world, x, z),
    });
    this.scene.add(this.weatherFx.group);
    this.chat.clear();
    this.loadingStarted = performance.now();
    this.menus.showLoading("Building terrain", 0);
  }

  /* ---------------------------------------------------------------- multiplayer */

  /** Connects to a friend's world and loads it (terrain from the seed, their changes from them). */
  private async joinWorld(code: string, name: string) {
    const guest = await GuestNet.join(code, name);
    const w = guest.welcome;
    const now = Date.now();
    const meta: WorldMeta = {
      id: `mp-${guest.code}`, name: w.world.name, seed: w.world.seed, seedText: String(w.world.seed), mode: w.world.mode,
      created: now, lastPlayed: now, time: w.time, player: null, spawnPoint: w.spawn, cheats: false, weather: w.weather,
    };
    // Back where you were, with your things, if you've played here before.
    meta.player = w.you ?? null;
    guest.onClosed = (reason, unexpected) => void this.connectionLost(code, name, reason, unexpected);
    await this.startSession(meta, guest);
    this.updateBackgroundTicker();
  }

  /** The link to the host dropped: try to get back in a few times before giving up. */
  private async connectionLost(code: string, name: string, reason: string, unexpected: boolean) {
    this.leaveToTitle(unexpected ? "" : reason);
    if (!unexpected) return;
    for (let attempt = 1; attempt <= 3; attempt++) {
      this.menus.showLoading(`Connection lost. Reconnecting (try ${attempt} of 3)...`, null);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        await this.joinWorld(code, name);
        this.chat.print("Reconnected", "info");
        return;
      } catch {
        // Try again.
      }
    }
    this.showTitle();
    this.menus.showJoin(`Disconnected: ${reason}`);
  }

  /*
   * Browsers almost stop a hidden tab's animation frames, which would freeze
   * a shared world for everyone. While hidden, a tiny worker's timer (which
   * the browser doesn't hold back the same way) keeps the game ticking.
   */
  private bgWorker: Worker | null = null;
  private bgLast = 0;

  private updateBackgroundTicker() {
    const want = document.visibilityState === "hidden" && !!this.session?.net;
    if (want && !this.bgWorker) {
      const src = "setInterval(() => postMessage(0), 50);";
      this.bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      this.bgLast = performance.now();
      this.bgWorker.onmessage = () => this.backgroundTick();
    } else if (!want && this.bgWorker) {
      this.bgWorker.terminate();
      this.bgWorker = null;
    }
  }

  private backgroundTick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.bgLast) / 1000);
    this.bgLast = now;
    const session = this.session;
    if (!session || document.visibilityState !== "hidden") return;
    session.update(dt, this.input, false, this.settings.renderDistance);
  }

  private async openToFriends(): Promise<string> {
    const session = this.session;
    if (!session) throw new Error("No world is open");
    const host = await session.openToFriends(this.settings.playerName);
    this.wireNet(host);
    this.updateBackgroundTicker();
    this.chat.print(`Your world is open to friends (up to 5 players). Room code: ${host.code}`, "info");
    return host.code;
  }

  private wireNet(net: HostNet | GuestNet) {
    net.onChat = (name, text) => this.chat.print(`<${name}> ${text}`);
    net.onInfo = (text) => this.chat.print(text, "info");
  }

  /** Leaves a friend's world (or loses the connection) and goes back to the menu. */
  private leaveToTitle(reason = "") {
    const session = this.session;
    if (session) {
      if (this.state === "container") this.containers.close();
      if (this.state === "chat") this.chat.close();
      this.scene.remove(session.group);
      session.dispose();
      if (this.weatherFx) this.scene.remove(this.weatherFx.group);
      this.weatherFx = null;
      this.audio.setRain(0);
      this.session = null;
    }
    this.input.captureKeys = false;
    this.expectUnlock = true;
    this.input.exitLock();
    this.updateBackgroundTicker();
    this.showTitle();
    if (reason) this.menus.showJoin(`Disconnected: ${reason}`);
  }

  private enterWorld() {
    this.menus.hide();
    this.canvas.classList.remove("is-blurred");
    this.hud.visible = true;
    this.state = "playing";
    this.input.captureKeys = true;
    this.hud.showClickToPlay = true;
    this.input.requestLock();
  }

  private onDeath() {
    const session = this.session;
    if (!session) return;
    if (this.state === "container") this.containers.close();
    this.state = "dead";
    this.input.captureKeys = false;
    this.expectUnlock = true;
    this.input.exitLock();
    this.hud.showClickToPlay = false;
    this.menus.showDeath(DEATH_MESSAGES[session.vitals.lastCause ?? "fall"] ?? "You died");
  }

  private respawn() {
    this.session?.respawn();
    this.menus.hide();
    this.state = "playing";
    this.input.captureKeys = true;
    this.hud.showClickToPlay = true;
    this.input.requestLock();
  }

  private async saveAndQuit() {
    const session = this.session;
    if (!session) return this.showTitle();
    // Leaving from the death screen respawns first, so the save never holds a dead player.
    if (session.vitals.dead) session.respawn();
    this.state = "saving";
    this.menus.showLoading("Saving world", null);
    const thumb = await this.captureThumbnail();
    await session.save(thumb).catch(() => {});
    this.scene.remove(session.group);
    session.dispose();
    if (this.weatherFx) this.scene.remove(this.weatherFx.group);
    this.weatherFx = null;
    this.audio.setRain(0);
    this.session = null;
    this.updateBackgroundTicker();
    this.showTitle();
  }

  private captureThumbnail(): Promise<string> {
    return new Promise((resolve) => {
      this.wantThumbnail = resolve;
      setTimeout(() => {
        if (this.wantThumbnail === resolve) {
          this.wantThumbnail = null;
          resolve("");
        }
      }, 500);
    });
  }

  /* ---------------------------------------------------------------- pause / containers */

  private pause() {
    if (this.state !== "playing") return;
    this.pausedAt = performance.now();
    this.state = "paused";
    this.input.captureKeys = false;
    this.expectUnlock = true;
    this.input.exitLock();
    this.hud.showClickToPlay = false;
    this.menus.showPause();
    void this.session?.save().catch(() => {});
  }

  private resume() {
    this.menus.hide();
    this.state = "playing";
    this.input.captureKeys = true;
    this.hud.showClickToPlay = true;
    this.input.requestLock();
  }

  private openContainer(mode: ContainerMode, furnace?: FurnaceState) {
    if (this.state !== "playing" || !this.session) return;
    if (mode === "inventory" && this.session.player.mode === "creative") mode = "creative";
    this.state = "container";
    this.input.captureKeys = false;
    this.expectUnlock = true;
    this.input.exitLock();
    this.hud.showClickToPlay = false;
    this.containers.open(mode, furnace);
  }

  private closeContainer(relock = true) {
    this.containers.close();
    this.session?.containerClosed();
    this.state = "playing";
    this.input.captureKeys = true;
    if (relock) {
      this.hud.showClickToPlay = true;
      this.input.requestLock();
    }
  }

  /* ---------------------------------------------------------------- chat */

  private openChat(prefix: string) {
    if (this.state !== "playing" || !this.session) return;
    this.state = "chat";
    this.input.captureKeys = false;
    this.expectUnlock = true;
    this.input.exitLock();
    this.hud.showClickToPlay = false;
    this.chat.open(prefix);
  }

  private closeChat() {
    if (this.state !== "chat") return;
    this.state = "playing";
    this.input.captureKeys = true;
    this.hud.showClickToPlay = true;
    this.input.requestLock();
  }

  private submitChat(text: string) {
    const session = this.session;
    if (!session) return;
    if (!text.startsWith("/")) {
      this.chat.print(`<${session.net?.selfName ?? "Player"}> ${text}`);
      session.net?.chat(text);
      return;
    }
    const result = session.command(text);
    this.chat.print(result.message, result.ok ? "info" : "error");
  }

  private onLockChange(locked: boolean) {
    if (locked) {
      this.expectUnlock = false;
      this.hud.showClickToPlay = false;
      if (this.state === "paused") {
        this.menus.hide();
        this.state = "playing";
        this.input.captureKeys = true;
      }
      return;
    }
    if (this.expectUnlock) {
      this.expectUnlock = false;
      return;
    }
    if (this.state === "playing") this.pause();
  }

  private onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.tagName === "INPUT") return;
    if (e.code === "F3" || e.code === "F1" || (e.code === "Tab" && this.state === "playing")) e.preventDefault();
    if (this.state === "container") {
      if (e.code === "KeyE" || e.code === "Escape") {
        e.preventDefault();
        this.closeContainer();
      } else {
        this.containers.handleKey(e.code);
      }
      return;
    }
    if (this.state === "paused" && e.code === "Escape") {
      e.preventDefault();
      // The same Esc that released the pointer lock must not also resume.
      if (performance.now() - this.pausedAt < 250) return;
      if (this.menus.current === "pause") this.resume();
      else this.menus.showPause();
      return;
    }
    if (this.state === "title" && e.code === "Escape" && this.menus.current !== "title") {
      this.menus.showTitle();
      return;
    }
    if (this.state !== "playing") return;
    // Usually the browser releases the lock on Esc and onLockChange pauses;
    // where the key reaches the page instead, pause from here.
    if (e.code === "Escape") {
      e.preventDefault();
      this.pause();
      return;
    }
    if (e.repeat) return;
    if (e.code === "KeyE") this.openContainer("inventory");
    else if (e.code === "KeyT" || e.code === "Slash" || e.code === "NumpadDivide") {
      e.preventDefault();
      this.openChat(e.code === "KeyT" ? "" : "/");
    }
    else if (e.code === "F3") this.showDebug = !this.showDebug;
    else if (e.code === "F7" && this.session) {
      e.preventDefault();
      this.hud.showHint(`Spawned ${this.session.debugSpawnNext()}`, 2);
    }
    else if (e.code === "F1") {
      this.hideHud = !this.hideHud;
      this.hud.minimal = this.hideHud;
    }
  }

  /* ---------------------------------------------------------------- frame */

  private frame(dt: number) {
    this.elapsed += dt;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    const s = this.settings;
    const session = this.session;
    let time = 1500;

    if (this.state === "title" && this.panorama) {
      const angle = this.elapsed * 0.035;
      this.camera.position.copy(this.panoramaOrigin);
      this.camera.rotation.set(-0.22, angle, 0, "YXZ");
      this.panorama.update(this.panoramaOrigin.x, this.panoramaOrigin.z);
      time = 2200;
      this.setFov(s.fov, dt);
    } else if (session) {
      const controls = this.state === "playing" && this.input.locked;
      // A world open to friends keeps running while you're in the menu.
      if ((this.state === "paused" || this.state === "saving") && !session.net) {
        session.world.update(session.player.pos.x, session.player.pos.z);
      } else {
        session.update(dt, this.input, controls, s.renderDistance);
        if (controls) session.player.applyLook(this.input, s.sensitivity / 100);
      }
      if ((this.state === "playing" || this.state === "container" || this.state === "chat") && session.vitals.dead) {
        if (this.state === "chat") {
          this.chat.onClose = null;
          this.chat.close();
          this.chat.onClose = () => this.closeChat();
        }
        this.onDeath();
      }
      if (this.state === "loading") {
        const progress = session.loadingProgress();
        this.menus.showLoading("Building terrain", progress);
        const timedOut = performance.now() - this.loadingStarted > 25000;
        if ((session.ready && progress >= 1) || (session.ready && timedOut)) this.enterWorld();
      }
      // Hold Tab to see who's here.
    if (session?.net && this.state === "playing" && this.input.keys.has("Tab")) {
      const net = session.net;
      const names = net instanceof HostNet ? net.names : [net.selfName, ...net.remotes.names()];
      this.hud.setPlayerList(names, `Players (${names.length}/5) · Room ${net.code}`);
    } else {
      this.hud.setPlayerList(null);
    }
    if (this.state === "playing" && controls && session.shouldAutosave()) {
        this.hud.showToast("Saving world...", 1.5);
        void session.save(undefined, false).catch(() => this.hud.showToast("Could not save", 3));
      }
      this.placeCamera(dt);
      time = session.time;
    }

    // Sky, light and fog.
    const weather = session && this.state !== "loading" ? session.weather : null;
    const sky = this.sky.update(time, this.camera, s.clouds, this.elapsed, weather?.gloom ?? 0, weather?.flash ?? 0);
    const u = this.uniforms;
    u.u_daylight.value = sky.daylight;
    u.u_skyTint.value.copy(sky.skyTint);
    u.u_time.value = this.elapsed;
    if (session) session.daylightFactor = sky.daylight;
    if (session) session.torchFx.setViewport(this.renderer.domElement.height, this.camera.fov);
    if (this.weatherFx && session) {
      this.weatherFx.update(dt, this.camera.position, this.state === "loading" ? 0 : session.weather.rain, session.snowMix, sky.daylight, this.elapsed);
    }
    const underwater = !!session && this.state !== "loading" && session.player.headInWater;
    const rd = this.state === "title" ? this.panorama?.renderDistance ?? 6 : s.renderDistance;
    if (underwater) {
      u.u_fogColor.value.set(0.06, 0.14, 0.38).multiplyScalar(0.35 + 0.65 * sky.daylight);
      u.u_fogNear.value = 1;
      u.u_fogFar.value = 22;
    } else {
      u.u_fogColor.value.copy(sky.fogColor);
      u.u_fogFar.value = rd * CHUNK_SIZE - 4;
      u.u_fogNear.value = u.u_fogFar.value * 0.62;
    }
    // Under the bottom of the world the light drains away: the sky goes black the deeper you fall.
    const abyss = session && this.state !== "loading" && this.state !== "title" ? Math.max(0, Math.min(1, -session.player.pos.y / 24)) : 0;
    if (abyss > 0) u.u_fogColor.value.multiplyScalar(1 - abyss);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setRGB(u.u_fogColor.value.x, u.u_fogColor.value.y, u.u_fogColor.value.z, THREE.SRGBColorSpace);
    fog.near = u.u_fogNear.value;
    fog.far = underwater ? u.u_fogFar.value : u.u_fogFar.value * 2.4;
    this.hud.underwater.classList.toggle("bv-hidden", !underwater);
    // Under water the sky disappears into the fog, as it would through murky water.
    this.sky.group.visible = !underwater && abyss < 0.85;
    if (underwater || abyss > 0.5) this.sky.clouds.visible = false;
    this.renderer.setClearColor(fog.color);

    this.renderer.info.reset();
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.frameStats.calls = this.renderer.info.render.calls;
    this.frameStats.triangles = this.renderer.info.render.triangles;
    const showHand = !!session && (this.state === "playing" || this.state === "container" || this.state === "paused") && !this.hideHud && !session.vitals.dead;
    if (showHand && session) {
      const held = session.inventory.held?.id ?? 0;
      this.viewModel.setHeld(held);
      const eye = session.player.eye();
      const light = session.world.getLight(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
      this.viewModel.update(dt, session.player.walkDist, s.viewBobbing, light, sky.daylight, session.eating, bowPower(session.bowDraw));
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewModel.scene, this.viewModel.camera);
      this.renderer.autoClear = true;
    }
    if (this.wantThumbnail) {
      const done = this.wantThumbnail;
      this.wantThumbnail = null;
      done(this.thumbnailFromCanvas());
    }

    if (session && this.state !== "loading" && this.state !== "title") {
      this.hud.updateHotbar(session.inventory, dt);
      this.hud.updateVitals(session.mode === "survival" ? session.vitals : null, session.inventory.armorPoints);
      this.hud.updateXp(session.mode === "survival" ? session.xp : null);
      this.hud.minimal = this.hideHud || this.state === "dead";
      this.hud.setDebug(this.showDebug ? this.debugLines(session) : null, this.showDebug ? this.debugRight(session) : []);
    }
    this.hud.setFps(s.showFps && !this.showDebug ? `${Math.round(this.fps)} FPS` : null);
    this.hud.tick(dt);
    this.containers.tick();
    this.chat.tick(dt);
    this.input.endFrame();
  }

  private setFov(target: number, dt: number) {
    this.fovCurrent += (target - this.fovCurrent) * (1 - Math.exp(-12 * dt));
    if (Math.abs(this.camera.fov - this.fovCurrent) > 0.01) {
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }
  }

  private placeCamera(dt: number) {
    const session = this.session!;
    const p = session.player;
    p.eye(this.camera.position, p.alpha);
    let roll = 0;
    if (this.settings.viewBobbing && p.onGround && !p.flying) {
      const speed = Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 4.3);
      const phase = p.walkDist * Math.PI;
      const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      this.camera.position.addScaledVector(right, Math.sin(phase) * 0.045 * speed);
      this.camera.position.y += -Math.abs(Math.cos(phase)) * 0.06 * speed;
      roll = Math.sin(phase) * 0.008 * speed;
    }
    // Taking damage jolts the view sideways for a moment.
    const hurt = session.vitals.hurtTime;
    if (hurt < 0.4) roll += Math.sin((hurt / 0.4) * Math.PI) * 0.09;
    if (session.vitals.dead) {
      this.camera.position.y -= 1.1;
      roll = 0.6;
    }
    this.camera.rotation.set(p.pitch, p.yaw, roll, "YXZ");
    const boost = p.sprinting ? (p.flying ? 1.15 : 1.12) : 1;
    // Drawing a bow narrows the view a little, like squinting down the arrow.
    const zoom = 1 - 0.15 * bowPower(session.bowDraw);
    this.setFov(this.settings.fov * boost * zoom * (p.headInWater ? 0.88 : 1), dt);
  }

  private thumbnailFromCanvas(): string {
    try {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      const src = this.canvas;
      const size = Math.min(src.width, src.height);
      ctx.drawImage(src, (src.width - size) / 2, (src.height - size) / 2, size, size, 0, 0, 64, 64);
      return c.toDataURL("image/jpeg", 0.8);
    } catch {
      return "";
    }
  }

  /* ---------------------------------------------------------------- debug */

  private debugLines(session: Session): string[] {
    const p = session.player;
    const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y), bz = Math.floor(p.pos.z);
    const cx = Math.floor(bx / 16), cz = Math.floor(bz / 16);
    const yawDeg = ((((-p.yaw * 180) / Math.PI) % 360) + 540) % 360 - 180;
    const quadrant = ((Math.round(p.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    const col = session.world.generator.column(bx, bz);
    const light = session.world.getLight(bx, Math.floor(p.pos.y + 0.5), bz);
    const day = Math.floor(session.time / DAY_TICKS);
    const sp = session.spawner.stats;
    const info = this.frameStats;
    const stats = session.world.stats;
    let meshed = 0;
    for (const c of session.world.chunks.values()) if (c.solidMesh || c.waterMesh) meshed++;
    return [
      `${GAME_NAME} ${GAME_VERSION} (${Math.round(this.fps)} fps)`,
      `Frame: ${this.cpuMs.toFixed(1)} ms of work${this.fps < 34 && this.cpuMs < 12 ? " · browser is capping fps (Energy Saver?)" : ""}`,
      `C: ${meshed}/${session.world.chunks.size} D: ${this.settings.renderDistance} draws: ${info.calls}`,
      `Workers: ${this.pool.size} gen ${stats.genMs.toFixed(1)}ms mesh ${stats.meshMs.toFixed(1)}ms`,
      "",
      `XYZ: ${p.pos.x.toFixed(3)} / ${p.pos.y.toFixed(3)} / ${p.pos.z.toFixed(3)}`,
      `Block: ${bx} ${by} ${bz}`,
      `Chunk: ${((bx % 16) + 16) % 16} ${by} ${((bz % 16) + 16) % 16} in ${cx} ${cz}`,
      `Facing: ${FACING[quadrant]} (${FACING_AXIS[quadrant]}) (${yawDeg.toFixed(1)} / ${((-p.pitch * 180) / Math.PI).toFixed(1)})`,
      `Biome: ${BIOME_NAMES[col.biome]}`,
      `Light: ${Math.max(light >> 4, light & 15)} (sky ${light >> 4}, block ${light & 15})`,
      `Day ${day} · time ${Math.floor(session.time % DAY_TICKS)}`,
      `Mode: ${p.mode}${p.flying ? " (flying)" : ""}${p.inWater ? " · in water" : ""}`,
      `Drops: ${session.drops.count} · Mobs: ${session.entities.mobs.size} · Arrows: ${session.projectiles.count} · XP orbs: ${session.xpOrbs.count}`,
      `XP: level ${session.xp.level} (${session.xp.total} points) · Armor: ${session.inventory.armorPoints}`,
      `Monsters ${sp.monsters}/${sp.monsterCap} · Animals ${sp.creatures}/${sp.creatureCap} (+${sp.persistent} persistent)`,
      `Internal sky light: ${internalSkyLight(light >> 4, session.time)} · Spawn attempts/s: ${sp.attemptsPerSecond}`,
      `Spawn cycle: ${sp.avgMs.toFixed(3)} ms avg, ${sp.maxMs.toFixed(2)} ms max`,
      `Weather: ${session.weather.kind} (${Math.round(session.weather.left)} s left) · ${isCold(col) ? "snowy" : "rainy"} biome · temp ${(col.temperature ?? 0).toFixed(2)}`,
      `Fluid queue: ${session.fluid.pending} · Redstone queue: ${session.redstone.pending} · Falling: ${session.falling.count}`,
      session.net instanceof HostNet ? `Multiplayer: hosting room ${session.net.code} · ${session.net.names.join(", ")}`
        : session.net instanceof GuestNet ? `Multiplayer: in room ${session.net.code} · ${session.net.remotes.count + 1} players` : "Multiplayer: off",
      `Cheats: ${session.cheats ? "on" : "off"}${session.meta.spawnPoint ? ` · Spawn point: ${session.meta.spawnPoint.join(" ")}` : ""}`,
    ];
  }

  private debugRight(session: Session): string[] {
    const t = session.interaction.target;
    const info = this.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const lines = [
      mem ? `JS heap: ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : "",
      `WebGL2 · ${this.renderer.getPixelRatio().toFixed(1)}x`,
      `Triangles: ${this.frameStats.triangles.toLocaleString()}`,
      `Geometries: ${info.memory.geometries}`,
      "",
    ];
    if (t) {
      lines.push(`Targeted Block: ${t.x}, ${t.y}, ${t.z}`, BLOCKS[t.id]?.name ?? "?");
    }
    const held = session.inventory.held;
    if (held) lines.push("", `Held: ${getItem(held.id)?.name ?? "?"}`);
    return lines;
  }
}
