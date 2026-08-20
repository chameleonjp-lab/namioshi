import {
  COLORMAPS,
  RippleEngine,
  pickGrid,
  viscosityToDamping,
} from "./ripple.js";

const FIXED_MS = 1000 / 60;
const canvas = document.querySelector("#surface");
const viscosityEl = document.querySelector("#viscosity");
const strengthEl = document.querySelector("#strength");
const viscosityValue = document.querySelector("#viscosity-value");
const strengthValue = document.querySelector("#strength-value");
const mapsEl = document.querySelector("#maps");
const clearBtn = document.querySelector("#clear");
const hintEl = document.querySelector("#hint");

const settings = {
  viscosity: 28,
  strength: 64,
  colormap: "abyss",
};

const pointers = new Map();
let engine = null;
let raf = 0;
let acc = 0;
let last = performance.now();

function syncLabels() {
  viscosityValue.textContent = String(settings.viscosity);
  strengthValue.textContent = String(settings.strength);
}

function layout() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const grid = pickGrid(cssW, cssH);
  if (!engine || engine.w !== grid.w || engine.h !== grid.h) {
    engine = new RippleEngine(grid.w, grid.h, settings.colormap);
    engine.damping = viscosityToDamping(settings.viscosity);
    engine.seed();
  }
}

function toGrid(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!engine || rect.width === 0 || rect.height === 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * engine.w,
    y: ((clientY - rect.top) / rect.height) * engine.h,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  const p = toGrid(e.clientX, e.clientY);
  if (!p) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, p);
  engine.drop(p.x, p.y, settings.strength);
  hintEl.hidden = true;
});

canvas.addEventListener("pointermove", (e) => {
  const lastPt = pointers.get(e.pointerId);
  if (!lastPt) return;
  const p = toGrid(e.clientX, e.clientY);
  if (!p) return;
  engine.disturbSegment(lastPt.x, lastPt.y, p.x, p.y, settings.strength);
  pointers.set(e.pointerId, p);
});

function release(e) {
  pointers.delete(e.pointerId);
}

canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("lostpointercapture", release);

viscosityEl.addEventListener("input", () => {
  settings.viscosity = Number(viscosityEl.value);
  if (engine) engine.damping = viscosityToDamping(settings.viscosity);
  syncLabels();
});

strengthEl.addEventListener("input", () => {
  settings.strength = Number(strengthEl.value);
  syncLabels();
});

clearBtn.addEventListener("click", () => {
  engine?.clear();
});

for (const map of COLORMAPS) {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "radio";
  button.setAttribute("aria-checked", map.id === settings.colormap ? "true" : "false");
  button.setAttribute("aria-label", map.label);
  button.innerHTML = `<span class="swatch" style="background:${map.swatch}"></span><span>${map.label}</span>`;
  button.addEventListener("click", () => {
    settings.colormap = map.id;
    engine?.setColormap(map.id);
    for (const node of mapsEl.querySelectorAll("button")) {
      node.setAttribute("aria-checked", node === button ? "true" : "false");
    }
  });
  mapsEl.append(button);
}

function tick(now) {
  const dt = Math.min(100, now - last);
  last = now;
  acc += dt;
  const ctx = canvas.getContext("2d");
  if (engine && ctx) {
    engine.damping = viscosityToDamping(settings.viscosity);
    engine.setColormap(settings.colormap);
    while (acc >= FIXED_MS) {
      engine.step();
      acc -= FIXED_MS;
    }
    engine.blit(ctx, canvas.width, canvas.height);
  }
  raf = requestAnimationFrame(tick);
}

layout();
syncLabels();
new ResizeObserver(layout).observe(canvas.parentElement);
raf = requestAnimationFrame(tick);
