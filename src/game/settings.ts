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
};

/** Options are a per-viewer convenience, so they live in localStorage (falling back to defaults). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: defaults are fine.
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignore: settings just won't persist.
  }
}
