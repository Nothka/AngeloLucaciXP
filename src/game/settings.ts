export interface Settings {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  masterVolume: number;
  musicVolume: number;
  showFps: boolean;
  viewBobbing: boolean;
  clouds: boolean;
  mobs: boolean;
  difficulty: "peaceful" | "normal";
  /** Name other players see in multiplayer. */
  playerName: string;
}

const KEY = "blockvale:settings:v1";

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 8,
  fov: 70,
  sensitivity: 100,
  masterVolume: 80,
  musicVolume: 50,
  showFps: false,
  viewBobbing: true,
  clouds: true,
  mobs: true,
  difficulty: "normal",
  playerName: "",
};

/** Options are a per-viewer convenience, so they live in localStorage (falling back to defaults). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withName({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    // Storage blocked or corrupt: defaults are fine.
  }
  return withName({ ...DEFAULT_SETTINGS });
}

/** Everyone starts with a name like "Player417" until they pick one. */
const withName = (s: Settings): Settings => (s.playerName ? s : { ...s, playerName: `Player${100 + Math.floor(Math.random() * 900)}` });

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore: settings just won't persist.
  }
}
