import { buildLut, type ColormapId } from "./colormaps";

function makeBufferCanvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  return { canvas, ctx };
}

export function pickGrid(cssW: number, cssH: number) {
  const cell = cssW < 600 ? 3.2 : 4.2;
  let w = Math.round(cssW / cell);
  let h = Math.round(cssH / cell);
  const maxCells = cssW < 600 ? 48_000 : 90_000;
  const area = Math.max(1, w * h);
  if (area > maxCells) {
    const s = Math.sqrt(maxCells / area);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return {
    w: Math.max(64, Math.min(360, w)),
    h: Math.max(64, Math.min(520, h)),
  };
}

export function viscosityToDamping(viscosity: number) {
  const t = Math.min(100, Math.max(0, viscosity)) / 100;
  return 0.996 - t * 0.11;
}

export class RippleEngine {
  w: number;
  h: number;
  current: Float32Array;
  previous: Float32Array;
  damping = 0.985;
  private colormapId: ColormapId;
  private lut: Uint8ClampedArray;
  private pixels: ImageData;
  private off: {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  };

  constructor(w: number, h: number, colormap: ColormapId) {
    this.w = w;
    this.h = h;
    this.current = new Float32Array(w * h);
    this.previous = new Float32Array(w * h);
    this.colormapId = colormap;
    this.lut = buildLut(colormap);
    this.pixels = new ImageData(w, h);
    this.off = makeBufferCanvas(w, h);
  }

  setColormap(id: ColormapId) {
    if (id === this.colormapId) return;
    this.colormapId = id;
    this.lut = buildLut(id);
  }

  seed() {
    const { w, h } = this;
    this.disturb(w * 0.5, h * 0.46, 6.4, 6.2);
    this.disturb(w * 0.32, h * 0.62, 4.2, 4.6);
    this.disturb(w * 0.7, h * 0.34, 5.1, 5.2);
    this.disturb(w * 0.58, h * 0.72, 3.2, 3.8);
  }

  clear() {
    this.current.fill(0);
    this.previous.fill(0);
  }

  disturb(cx: number, cy: number, amp: number, radius: number) {
    const { w, h, current } = this;
    const r = Math.max(1.2, radius);
    const r2 = r * r;
    const minX = Math.max(1, Math.floor(cx - r));
    const maxX = Math.min(w - 2, Math.ceil(cx + r));
    const minY = Math.max(1, Math.floor(cy - r));
    const maxY = Math.min(h - 2, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const falloff = 1 - d2 / r2;
        current[row + x]! += amp * falloff * falloff;
      }
    }
  }

  disturbSegment(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    strength: number,
  ) {
    const t = Math.min(100, Math.max(0, strength)) / 100;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist * 1.85));
    const amp = (0.42 + t * 7.6) / Math.pow(steps, 0.32);
    const radius = 2.15 + t * 3.6 + Math.min(dist * 0.12, 2.8);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      this.disturb(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, amp, radius);
    }
  }

  drop(x: number, y: number, strength: number) {
    const t = Math.min(100, Math.max(0, strength)) / 100;
    this.disturb(x, y, 0.55 + t * 8.2, 2.4 + t * 4.2);
  }

  step() {
    const { w, h, damping, current: curr, previous: prev } = this;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        prev[i] =
          ((curr[i - 1]! + curr[i + 1]! + curr[i - w]! + curr[i + w]!) * 0.5 -
            prev[i]!) *
          damping;
      }
    }
    this.current = prev;
    this.previous = curr;
  }

  blit(target: CanvasRenderingContext2D, dw: number, dh: number) {
    this.paint();
    this.off.ctx.putImageData(this.pixels, 0, 0);
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.drawImage(this.off.canvas, 0, 0, dw, dh);
  }

  private paint() {
    const { w, h, current, lut, pixels } = this;
    const data = pixels.data;
    const lx = -0.42;
    const ly = -0.58;
    const lz = 0.7;
    const scale = 0.62;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        const z = current[i]!;
        const dx = (current[i - 1]! - current[i + 1]!) * scale;
        const dy = (current[i - w]! - current[i + w]!) * scale;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        const nx = dx * inv;
        const ny = dy * inv;
        const nz = inv;
        const ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);
        const hx = lx;
        const hy = ly;
        const hz = lz + 1;
        const hinv = 1 / Math.sqrt(hx * hx + hy * hy + hz * hz);
        const spec = Math.pow(
          Math.max(0, nx * hx * hinv + ny * hy * hinv + nz * hz * hinv),
          42,
        );
        const crest = Math.min(1, Math.hypot(dx, dy) * 1.4);
        const mapped = 0.5 + 0.5 * Math.tanh(z * 0.38 + crest * 0.22);
        const idx = (mapped * 255) | 0;
        const li = idx * 3;
        const shade = 0.28 + 0.72 * ndotl;
        const hi = i * 4;
        data[hi] = Math.min(255, lut[li]! * shade + spec * 235);
        data[hi + 1] = Math.min(255, lut[li + 1]! * shade + spec * 235);
        data[hi + 2] = Math.min(255, lut[li + 2]! * shade + spec * 240);
        data[hi + 3] = 255;
      }
    }
    const copyEdge = (from: number, to: number) => {
      const s = from * 4;
      const d = to * 4;
      data[d] = data[s]!;
      data[d + 1] = data[s + 1]!;
      data[d + 2] = data[s + 2]!;
      data[d + 3] = 255;
    };
    for (let x = 0; x < w; x++) {
      copyEdge(w + Math.min(w - 1, Math.max(1, x)), x);
      copyEdge((h - 2) * w + Math.min(w - 1, Math.max(1, x)), (h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      copyEdge(y * w + 1, y * w);
      copyEdge(y * w + (w - 2), y * w + (w - 1));
    }
  }
}
