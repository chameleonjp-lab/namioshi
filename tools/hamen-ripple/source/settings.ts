import type { ColormapId } from "./colormaps";

export type RippleSettings = {
  viscosity: number;
  strength: number;
  colormap: ColormapId;
};

export const DEFAULT_SETTINGS: RippleSettings = {
  viscosity: 28,
  strength: 64,
  colormap: "abyss",
};

const KEY = "hamen.settings.v1";

export function loadSettings(): RippleSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<RippleSettings>;
    return {
      viscosity: clamp(parsed.viscosity ?? DEFAULT_SETTINGS.viscosity, 0, 100),
      strength: clamp(parsed.strength ?? DEFAULT_SETTINGS.strength, 0, 100),
      colormap: isColormap(parsed.colormap)
        ? parsed.colormap
        : DEFAULT_SETTINGS.colormap,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: RippleSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}

function isColormap(v: unknown): v is ColormapId {
  return (
    v === "abyss" ||
    v === "glacier" ||
    v === "thermal" ||
    v === "ink" ||
    v === "forest" ||
    v === "pearl"
  );
}
