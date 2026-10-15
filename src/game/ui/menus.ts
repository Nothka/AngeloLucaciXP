import { GAME_NAME, GAME_VERSION } from "../config";
import { IS_MAC } from "../input/input";
import type { GameMode } from "../player/player";
import type { WorldMeta } from "../save/db";
import type { Settings } from "../settings";
import { button, h, px, slider } from "./dom";
import { SPLASHES, logoSvg } from "./logo";
import { achievementsScreen } from "./achievementsScreen";
import { emptyAchievementState, type AchievementState } from "../achievements/tracker";

export interface MenuHost {
  settings: Settings;
  embedded: boolean;
  applySettings(): void;
  listWorlds(): Promise<WorldMeta[]>;
  createWorld(name: string, seedText: string, mode: GameMode, cheats: boolean): void;
  playWorld(meta: WorldMeta): void;
  deleteWorld(id: string): Promise<void>;
  /** One line about the cloud copy of the player, shown in the pause menu. */
  cloudStatus?(): string;
  quitGame(): void;
  resume(): void;
  saveAndQuit(): void;
  gameMode(): GameMode | null;
  respawn(): void;
  /** The open world's achievements, for the pause menu. */
  currentAchievements(): { state: AchievementState; worldName: string } | null;
  setGameMode(mode: GameMode): void;
}

const formatDate = (t: number) =>
  new Date(t).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Title, world selection, world creation, options and pause screens. */
export class Menus {
  readonly el: HTMLDivElement;
  current: string | null = null;
  private selectedWorld: WorldMeta | null = null;

  constructor(private host: MenuHost) {
    this.el = h("div.bv-layer.bv-menus");
  }

  private mount(name: string, screen: HTMLElement) {
    this.current = name;
    this.el.replaceChildren(screen);
    const first = screen.querySelector<HTMLElement>("input, .bv-btn:not(:disabled)");
    if (first?.tagName === "INPUT") first.focus();
  }

  hide() {
    this.current = null;
    this.el.replaceChildren();
  }

  /* ---------------------------------------------------------------- title */

  showTitle() {
    const logo = h("div.bv-logo");
    logo.innerHTML = logoSvg();
    logo.append(h("div.bv-edition", {}, "SANDBOX EDITION"));
    logo.append(h("div.bv-splash.bv-text", {}, SPLASHES[Math.floor(Math.random() * SPLASHES.length)]));
    const buttons = h("div.bv-stack.bv-menu-buttons", {},
      button("Singleplayer", () => this.showWorlds()),
      button("Achievements", () => void this.showTitleAchievements(0)),
      h("div.bv-row", {},
        button("Options...", () => this.showOptions(() => this.showTitle()), "is-half"),
        button(this.host.embedded ? "Close Game" : "Quit Game", () => this.host.quitGame(), "is-half"),
      ),
    );
    const screen = h("div.bv-screen", {},
      logo,
      buttons,
      h("div.bv-corner.is-left.bv-text", {}, `${GAME_NAME} ${GAME_VERSION}`),
      h("div.bv-corner.is-right.bv-text", {}, "An original voxel sandbox"),
    );
    this.mount("title", screen);
  }

  /* ---------------------------------------------------------------- achievements */

  /** From the title screen: achievements of a saved world, newest first. */
  async showTitleAchievements(index: number) {
    let worlds: WorldMeta[] = [];
    try {
      worlds = await this.host.listWorlds();
    } catch {
      // Storage unavailable: show the empty tree.
    }
    const world = worlds.length ? worlds[((index % worlds.length) + worlds.length) % worlds.length] : null;
    const screen = achievementsScreen({
      state: world?.achievements ?? emptyAchievementState(),
      worldName: world?.name ?? null,
      inGame: false,
      onDone: () => this.showTitle(),
      switcher: worlds.length > 1 ? { label: "Next World", next: () => void this.showTitleAchievements(index + 1) } : null,
      emptyNote: world ? undefined : "Create a world to start earning achievements",
    });
    this.mount("achievements", screen);
  }

  showGameAchievements() {
    const current = this.host.currentAchievements();
    if (!current) return;
    this.mount("achievements", achievementsScreen({
      state: current.state,
      worldName: current.worldName,
      inGame: true,
      onDone: () => this.showPause(),
    }));
  }

  /* ---------------------------------------------------------------- worlds */

  async showWorlds() {
    const list = h("div.bv-list");
    const play = button("Play Selected World", () => this.selectedWorld && this.host.playWorld(this.selectedWorld));
    const del = button("Delete", () => this.selectedWorld && this.confirmDelete(this.selectedWorld), "is-third");
    play.disabled = true;
    del.disabled = true;
    const screen = h("div.bv-screen.is-dim", {},
      h("div.bv-screen-title.bv-text", { style: `margin:${px(10)} 0 ${px(8)}` }, "Select World"),
      list,
      h("div.bv-world-bar", {},
        h("div.bv-row", {}, play, button("Create New World", () => this.showCreate())),
        h("div.bv-row", {}, del, button("Back", () => this.showTitle(), "is-third")),
      ),
    );
    this.mount("worlds", screen);
    this.selectedWorld = null;
    let worlds: WorldMeta[] = [];
    try {
      worlds = await this.host.listWorlds();
    } catch {
      list.append(h("div.bv-list-empty.bv-text", {}, "Saving is unavailable in this browser."));
      return;
    }
    if (this.current !== "worlds") return;
    if (!worlds.length) {
      list.append(h("div.bv-list-empty.bv-text", {}, "No worlds yet. Create one!"));
      return;
    }
    for (const w of worlds) {
      const thumb = h("div.bv-world-thumb", { style: w.thumbnail ? `background-image:url(${w.thumbnail})` : "background:#3a6b2a" });
      const entry = h("div.bv-world-entry", {},
        thumb,
        h("div.bv-world-meta.bv-text", {},
          h("div.bv-world-name", {}, w.name),
          h("div.bv-world-sub", {}, `${formatDate(w.lastPlayed)}`),
          h("div.bv-world-sub", {}, `${w.mode === "creative" ? "Creative" : "Survival"} · seed ${w.seedText || w.seed}`),
        ),
      );
      entry.addEventListener("click", () => {
        this.selectedWorld = w;
        list.querySelectorAll(".bv-world-entry").forEach((e) => e.classList.remove("is-selected"));
        entry.classList.add("is-selected");
        play.disabled = false;
        del.disabled = false;
      });
      entry.addEventListener("dblclick", () => this.host.playWorld(w));
      list.append(entry);
    }
  }

  private confirmDelete(world: WorldMeta) {
    const screen = h("div.bv-screen.is-dim", { style: "justify-content:center" },
      h("div.bv-text", { style: `margin-bottom:${px(8)}` }, "Are you sure you want to delete this world?"),
      h("div.bv-text", { style: `color:#a09d97;margin-bottom:${px(20)}` }, `'${world.name}' will be lost forever! (A long time!)`),
      h("div.bv-row", {},
        button("Delete", async () => {
          await this.host.deleteWorld(world.id).catch(() => {});
          void this.showWorlds();
        }, "is-wide"),
        button("Cancel", () => void this.showWorlds(), "is-wide"),
      ),
    );
    this.mount("delete", screen);
  }

  /* ---------------------------------------------------------------- create */

  showCreate() {
    let mode: GameMode = "survival";
    let cheats = false;
    const cheatsBtn = button("", () => {
      cheats = !cheats;
      cheatsBtn.textContent = `Allow Cheats: ${cheats ? "ON" : "OFF"}`;
    });
    cheatsBtn.textContent = "Allow Cheats: OFF";
    const name = h("input.bv-input", { maxlength: 32, value: "New World", spellcheck: "false" });
    const seed = h("input.bv-input", { maxlength: 32, placeholder: "Leave blank for a random seed", spellcheck: "false" });
    const modeHint = h("div.bv-hint.bv-text");
    const modeBtn = button("", () => {
      mode = mode === "survival" ? "creative" : "survival";
      // Like the classic menu, Creative turns cheats on (and Survival back off).
      cheats = mode === "creative";
      cheatsBtn.textContent = `Allow Cheats: ${cheats ? "ON" : "OFF"}`;
      renderMode();
    });
    const renderMode = () => {
      modeBtn.textContent = `Game Mode: ${mode === "survival" ? "Survival" : "Creative"}`;
      modeHint.textContent =
        mode === "survival"
          ? "Gather resources, craft tools and build. Blocks take time to break."
          : "Unlimited blocks, instant breaking. Double-tap Space to fly.";
    };
    renderMode();
    const create = () => this.host.createWorld(name.value.trim() || "New World", seed.value, mode, cheats);
    for (const input of [name, seed]) input.addEventListener("keydown", (e) => e.key === "Enter" && create());
    const screen = h("div.bv-screen.is-dim", {},
      h("div.bv-screen-title.bv-text", {}, "Create New World"),
      h("div.bv-stack", {},
        h("div.bv-field-label.bv-text", {}, "World Name"),
        name,
        h("div", { style: `height:${px(6)}` }),
        h("div.bv-field-label.bv-text", {}, "Seed for the world generator"),
        seed,
        h("div", { style: `height:${px(6)}` }),
        modeBtn,
        modeHint,
        h("div", { style: `height:${px(4)}` }),
        cheatsBtn,
        h("div.bv-hint.bv-text", {}, "Commands like /gamemode, /time and /give (open the chat with T or /)"),
      ),
      h("div.bv-footer", {},
        h("div.bv-row", {},
          button("Create New World", create, "is-wide"),
          button("Cancel", () => void this.showWorlds(), "is-wide"),
        ),
      ),
    );
    this.mount("create", screen);
    name.select();
  }

  /* ---------------------------------------------------------------- options */

  showOptions(back: () => void, inGame = false) {
    const s = this.host.settings;
    const apply = () => this.host.applySettings();
    const toggle = (label: string, key: "showFps" | "viewBobbing" | "clouds" | "mobs") => {
      const b = button("", () => {
        s[key] = !s[key];
        render();
        apply();
      });
      const render = () => (b.textContent = `${label}: ${s[key] ? "ON" : "OFF"}`);
      render();
      return b;
    };
    const grid = h("div.bv-options-grid", {},
      slider(30, 110, 1, s.fov, (v) => `FOV: ${v === 70 ? "Normal" : v === 110 ? "Quake Pro" : v}`, (v) => { s.fov = v; apply(); }),
      slider(2, 16, 1, s.renderDistance, (v) => `Render Distance: ${v} chunks`, (v) => { s.renderDistance = v; apply(); }),
      slider(10, 200, 1, s.sensitivity, (v) => `Sensitivity: ${v}%`, (v) => { s.sensitivity = v; apply(); }),
      slider(0, 100, 1, s.masterVolume, (v) => `Master Volume: ${v === 0 ? "OFF" : v + "%"}`, (v) => { s.masterVolume = v; apply(); }),
      slider(0, 100, 1, s.musicVolume, (v) => `Music: ${v === 0 ? "OFF" : v + "%"}`, (v) => { s.musicVolume = v; apply(); }),
      toggle("Show FPS", "showFps"),
      toggle("View Bobbing", "viewBobbing"),
      toggle("Clouds", "clouds"),
      toggle("Mobs", "mobs"),
      (() => {
        const b = button("", () => {
          s.difficulty = s.difficulty === "normal" ? "peaceful" : "normal";
          render();
          apply();
        });
        const render = () => (b.textContent = `Difficulty: ${s.difficulty === "normal" ? "Normal" : "Peaceful"}`);
        render();
        return b;
      })(),
    );
    const screen = h(`div.bv-screen.${inGame ? "is-ingame" : "is-dim"}` as "div", {},
      h("div.bv-screen-title.bv-text", {}, "Options"),
      grid,
      h("div", { style: `height:${px(8)}` }),
      button("Controls...", () => this.showControls(() => this.showOptions(back, inGame), inGame)),
      h("div.bv-footer", {}, button("Done", back)),
    );
    this.mount("options", screen);
  }

  showControls(back: () => void, inGame = false) {
    const rows: [string, string][] = [
      ["Move", "W A S D"],
      ["Jump / Swim up", "Space"],
      ["Sneak / Fly down", "Shift"],
      ["Sprint", IS_MAC ? "Option or double-tap W" : "Alt or double-tap W"],
      ["Fly (Creative)", "Double-tap Space"],
      ["Break / Place", IS_MAC ? "Click / Two-finger or Ctrl-click" : "Left / Right click"],
      ["Eat", "Hold right click with food"],
      ["Pick block", "Middle click"],
      ["Inventory", "E"],
      ["Drop item", "Q"],
      ["Hotbar", "1-9, mouse wheel"],
      ["Chat / Commands", "T or /"],
      ["Hide HUD / Debug", "F1 / F3"],
      ["Pause", "Esc"],
    ];
    const table = h("div", { style: `display:grid;grid-template-columns:${px(120)} ${px(150)};gap:${px(5)} ${px(10)}` });
    for (const [a, b] of rows) {
      table.append(h("div.bv-text", { style: "color:#c9c5bd;text-align:right" }, a), h("div.bv-text", {}, b));
    }
    const screen = h(`div.bv-screen.${inGame ? "is-ingame" : "is-dim"}` as "div", {},
      h("div.bv-screen-title.bv-text", {}, "Controls"),
      table,
      h("div.bv-footer", {}, button("Done", back)),
    );
    this.mount("controls", screen);
  }

  /* ---------------------------------------------------------------- in game */

  showPause() {
    const screen = h("div.bv-screen.is-ingame", { style: "justify-content:center" },
      h("div.bv-text", { style: `margin-bottom:${px(24)}` }, "Game Menu"),
      h("div.bv-stack", {},
        button("Resume", () => this.host.resume()),
        h("div", { style: `height:${px(8)}` }),
        button("Achievements", () => this.showGameAchievements()),
        button(`Game Mode: ${this.host.gameMode() === "creative" ? "Creative" : "Survival"}`, () => {
          this.host.setGameMode(this.host.gameMode() === "creative" ? "survival" : "creative");
          this.showPause();
        }),
        button("Options...", () => this.showOptions(() => this.showPause(), true)),
        button("Save and Quit to Title", () => this.host.saveAndQuit()),
      ),
    );
    let status: HTMLDivElement | null = null;
    if (this.host.cloudStatus) {
      status = h("div.bv-hint.bv-text", { style: `margin-top:${px(14)};opacity:0.8` }, this.host.cloudStatus());
      screen.append(status);
    }
    this.mount("pause", screen);
    // Kept fresh while the menu is open: the upload finishes a moment after pausing.
    const refresh = () => {
      if (!status?.isConnected) return;
      status.textContent = this.host.cloudStatus!();
      setTimeout(refresh, 500);
    };
    setTimeout(refresh, 500);
  }

  showDeath(message: string) {
    const respawn = button("Respawn", () => this.host.respawn());
    const title = button("Title Screen", () => this.host.saveAndQuit());
    // Like the original, the buttons unlock after a moment so a stray click can't skip the screen.
    respawn.disabled = true;
    title.disabled = true;
    setTimeout(() => {
      respawn.disabled = false;
      title.disabled = false;
    }, 1000);
    const screen = h("div.bv-screen.is-dead", {},
      h("div.bv-death-title", {}, "You Died!"),
      h("div.bv-text", { style: `margin-bottom:${px(28)}` }, message),
      h("div.bv-stack", {}, respawn, title),
    );
    this.mount("death", screen);
  }

  showLoading(title: string, progress: number | null) {
    if (this.current !== "loading") {
      const fill = h("div.bv-progress-fill");
      const screen = h("div.bv-screen.bv-loading", {},
        h("div.bv-text.bv-loading-title", {}, title),
        h("div.bv-text.bv-loading-sub", { style: "color:#c9c5bd" }, ""),
        h("div.bv-progress", {}, fill),
      );
      this.mount("loading", screen);
    }
    const t = this.el.querySelector(".bv-loading-title");
    if (t && t.textContent !== title) t.textContent = title;
    const bar = this.el.querySelector(".bv-progress") as HTMLElement | null;
    const fill = this.el.querySelector(".bv-progress-fill") as HTMLElement | null;
    if (bar) bar.style.visibility = progress === null ? "hidden" : "visible";
    if (fill && progress !== null) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress)).toFixed(3)})`;
    const sub = this.el.querySelector(".bv-loading-sub");
    if (sub) sub.textContent = progress === null ? "" : "Building terrain";
  }
}
