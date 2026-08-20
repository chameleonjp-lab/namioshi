const STOPS = {
  abyss: [
    [0, 4, 10, 16],
    [0.28, 8, 38, 52],
    [0.52, 18, 92, 108],
    [0.74, 72, 186, 188],
    [1, 226, 248, 244],
  ],
  glacier: [
    [0, 6, 12, 22],
    [0.3, 18, 52, 88],
    [0.58, 62, 148, 196],
    [0.82, 168, 216, 236],
    [1, 242, 250, 255],
  ],
  thermal: [
    [0, 8, 6, 10],
    [0.28, 72, 18, 28],
    [0.52, 188, 48, 32],
    [0.76, 236, 148, 36],
    [1, 255, 244, 214],
  ],
  ink: [
    [0, 8, 9, 11],
    [0.35, 36, 42, 50],
    [0.62, 92, 104, 116],
    [0.84, 176, 184, 192],
    [1, 236, 238, 240],
  ],
  forest: [
    [0, 6, 12, 8],
    [0.3, 10, 48, 28],
    [0.55, 36, 112, 56],
    [0.78, 164, 196, 72],
    [1, 236, 248, 214],
  ],
  pearl: [
    [0, 18, 16, 14],
    [0.34, 62, 56, 50],
    [0.62, 168, 152, 136],
    [0.84, 228, 216, 204],
    [1, 248, 244, 238],
  ],
};

export const COLORMAPS = [
  { id: "abyss", label: "深海", swatch: "#3aa8b0" },
  { id: "glacier", label: "氷河", swatch: "#7ec8e8" },
  { id: "thermal", label: "熱", swatch: "#e07040" },
  { id: "ink", label: "墨", swatch: "#9aa4ae" },
  { id: "forest", label: "森", swatch: "#5aaa62" },
  { id: "pearl", label: "真珠", swatch: "#d8cfc4" },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function buildLut(id) {
  const stops = STOPS[id] || STOPS.abyss;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    const span = b[0] - a[0] || 1;
    const u = smoothstep(Math.min(1, Math.max(0, (t - a[0]) / span)));
    const o = i * 3;
    lut[o] = lerp(a[1], b[1], u);
    lut[o + 1] = lerp(a[2], b[2], u);
    lut[o + 2] = lerp(a[3], b[3], u);
  }
  return lut;
}

function makeBufferCanvas(w, h) {
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

export function pickGrid(cssW, cssH) {
  const cell = cssW < 600 ? 3.2 : 4.2;
  let w = Math.round(cssW / cell);
  let h = Math.round(cssH / cell);
  const maxCells = cssW < 600 ? 48000 : 90000;
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

export function viscosityToDamping(viscosity) {
  const t = Math.min(100, Math.max(0, viscosity)) / 100;
  return 0.996 - t * 0.11;
}

export class RippleEngine {
  constructor(w, h, colormap) {
    this.w = w;
    this.h = h;
    this.current = new Float32Array(w * h);
    this.previous = new Float32Array(w * h);
    this.damping = 0.985;
    this.colormapId = colormap;
    this.lut = buildLut(colormap);
    this.pixels = new ImageData(w, h);
    this.off = makeBufferCanvas(w, h);
  }

  setColormap(id) {
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

  disturb(cx, cy, amp, radius) {
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
        current[row + x] += amp * falloff * falloff;
      }
    }
  }

  disturbSegment(x0, y0, x1, y1, strength) {
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

  drop(x, y, strength) {
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
          ((curr[i - 1] + curr[i + 1] + curr[i - w] + curr[i + w]) * 0.5 -
            prev[i]) *
          damping;
      }
    }
    this.current = prev;
    this.previous = curr;
  }

  blit(target, dw, dh) {
    this.paint();
    this.off.ctx.putImageData(this.pixels, 0, 0);
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
    target.drawImage(this.off.canvas, 0, 0, dw, dh);
  }

  paint() {
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
        const z = current[i];
        const dx = (current[i - 1] - current[i + 1]) * scale;
        const dy = (current[i - w] - current[i + w]) * scale;
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
        data[hi] = Math.min(255, lut[li] * shade + spec * 235);
        data[hi + 1] = Math.min(255, lut[li + 1] * shade + spec * 235);
        data[hi + 2] = Math.min(255, lut[li + 2] * shade + spec * 240);
        data[hi + 3] = 255;
      }
    }
    const copyEdge = (from, to) => {
      const s = from * 4;
      const d = to * 4;
      data[d] = data[s];
      data[d + 1] = data[s + 1];
      data[d + 2] = data[s + 2];
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
