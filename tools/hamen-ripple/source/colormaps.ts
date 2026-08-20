export type ColormapId =
  | "abyss"
  | "glacier"
  | "thermal"
  | "ink"
  | "forest"
  | "pearl";

export type ColormapDef = {
  id: ColormapId;
  label: string;
  swatch: string;
};

export const COLORMAPS: readonly ColormapDef[] = [
  { id: "abyss", label: "深海", swatch: "#3aa8b0" },
  { id: "glacier", label: "氷河", swatch: "#7ec8e8" },
  { id: "thermal", label: "熱", swatch: "#e07040" },
  { id: "ink", label: "墨", swatch: "#9aa4ae" },
  { id: "forest", label: "森", swatch: "#5aaa62" },
  { id: "pearl", label: "真珠", swatch: "#d8cfc4" },
];

type Stop = { t: number; r: number; g: number; b: number };

const STOPS: Record<ColormapId, Stop[]> = {
  abyss: [
    { t: 0, r: 4, g: 10, b: 16 },
    { t: 0.28, r: 8, g: 38, b: 52 },
    { t: 0.52, r: 18, g: 92, b: 108 },
    { t: 0.74, r: 72, g: 186, b: 188 },
    { t: 1, r: 226, g: 248, b: 244 },
  ],
  glacier: [
    { t: 0, r: 6, g: 12, b: 22 },
    { t: 0.3, r: 18, g: 52, b: 88 },
    { t: 0.58, r: 62, g: 148, b: 196 },
    { t: 0.82, r: 168, g: 216, b: 236 },
    { t: 1, r: 242, g: 250, b: 255 },
  ],
  thermal: [
    { t: 0, r: 8, g: 6, b: 10 },
    { t: 0.28, r: 72, g: 18, b: 28 },
    { t: 0.52, r: 188, g: 48, b: 32 },
    { t: 0.76, r: 236, g: 148, b: 36 },
    { t: 1, r: 255, g: 244, b: 214 },
  ],
  ink: [
    { t: 0, r: 8, g: 9, b: 11 },
    { t: 0.35, r: 36, g: 42, b: 50 },
    { t: 0.62, r: 92, g: 104, b: 116 },
    { t: 0.84, r: 176, g: 184, b: 192 },
    { t: 1, r: 236, g: 238, b: 240 },
  ],
  forest: [
    { t: 0, r: 6, g: 12, b: 8 },
    { t: 0.3, r: 10, g: 48, b: 28 },
    { t: 0.55, r: 36, g: 112, b: 56 },
    { t: 0.78, r: 164, g: 196, b: 72 },
    { t: 1, r: 236, g: 248, b: 214 },
  ],
  pearl: [
    { t: 0, r: 18, g: 16, b: 14 },
    { t: 0.34, r: 62, g: 56, b: 50 },
    { t: 0.62, r: 168, g: 152, b: 136 },
    { t: 0.84, r: 228, g: 216, b: 204 },
    { t: 1, r: 248, g: 244, b: 238 },
  ],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

export function buildLut(id: ColormapId): Uint8ClampedArray {
  const stops = STOPS[id];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0]!;
    let b = stops[stops.length - 1]!;
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s]!.t && t <= stops[s + 1]!.t) {
        a = stops[s]!;
        b = stops[s + 1]!;
        break;
      }
    }
    const span = b.t - a.t || 1;
    const u = smoothstep(Math.min(1, Math.max(0, (t - a.t) / span)));
    const o = i * 3;
    lut[o] = lerp(a.r, b.r, u);
    lut[o + 1] = lerp(a.g, b.g, u);
    lut[o + 2] = lerp(a.b, b.b, u);
  }
  return lut;
}
