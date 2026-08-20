import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Eraser } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { COLORMAPS, type ColormapId } from "@/lib/ripple/colormaps";
import {
  pickGrid,
  RippleEngine,
  viscosityToDamping,
} from "@/lib/ripple/engine";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type RippleSettings,
} from "@/lib/ripple/settings";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const FIXED_MS = 1000 / 60;

export function RippleStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RippleEngine | null>(null);
  const settingsRef = useRef<RippleSettings>(DEFAULT_SETTINGS);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const [settings, setSettings] = useState<RippleSettings>(DEFAULT_SETTINGS);
  const [hint, setHint] = useState(true);
  const [ready, setReady] = useState(false);

  settingsRef.current = settings;

  const patch = useCallback((partial: Partial<RippleSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement ?? canvas;
    let raf = 0;
    let running = true;
    let acc = 0;
    let last = performance.now();

    const layout = () => {
      const rect = parent.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const grid = pickGrid(cssW, cssH);
      const prev = engineRef.current;
      if (!prev || prev.w !== grid.w || prev.h !== grid.h) {
        const engine = new RippleEngine(
          grid.w,
          grid.h,
          settingsRef.current.colormap,
        );
        engine.damping = viscosityToDamping(settingsRef.current.viscosity);
        engine.seed();
        engineRef.current = engine;
      }
    };

    const toGrid = (clientX: number, clientY: number) => {
      const engine = engineRef.current;
      const rect = canvas.getBoundingClientRect();
      if (!engine || rect.width === 0 || rect.height === 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * engine.w,
        y: ((clientY - rect.top) / rect.height) * engine.h,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const p = toGrid(e.clientX, e.clientY);
      if (!p) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, p);
      engineRef.current?.drop(p.x, p.y, settingsRef.current.strength);
      setHint(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      const lastPt = pointersRef.current.get(e.pointerId);
      if (!lastPt) return;
      const p = toGrid(e.clientX, e.clientY);
      if (!p) return;
      engineRef.current?.disturbSegment(
        lastPt.x,
        lastPt.y,
        p.x,
        p.y,
        settingsRef.current.strength,
      );
      pointersRef.current.set(e.pointerId, p);
    };

    const onPointerUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(100, now - last);
      last = now;
      acc += dt;
      const engine = engineRef.current;
      const ctx = canvas.getContext("2d");
      if (engine && ctx) {
        const s = settingsRef.current;
        engine.damping = viscosityToDamping(s.viscosity);
        engine.setColormap(s.colormap);
        while (acc >= FIXED_MS) {
          engine.step();
          acc -= FIXED_MS;
        }
        engine.blit(ctx, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(tick);
    };

    layout();
    setReady(true);
    const ro = new ResizeObserver(layout);
    ro.observe(parent);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", onPointerUp);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("lostpointercapture", onPointerUp);
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        aria-label="流体表面"
      />
      {!ready ? <div className="absolute inset-0 bg-bg" /> : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <div>
          <p className="font-display text-2xl leading-tight tracking-display text-fg">
            HAMEN
          </p>
          <p className="mt-0.5 text-xs tracking-wide text-muted">波面</p>
        </div>
        <div className="pointer-events-auto">
          <AuthChip />
        </div>
      </header>

      <aside
        className="absolute top-24 left-[max(1rem,env(safe-area-inset-left))] z-10 w-[min(20.5rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface/88 p-4 md:top-28"
        aria-label="シミュレーション操作"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted">
            表面コントロール
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => engineRef.current?.clear()}
            className="gap-1.5"
          >
            <Eraser />
            クリア
          </Button>
        </div>

        <ControlRow label="粘性" value={settings.viscosity}>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[settings.viscosity]}
            onValueChange={(v) => patch({ viscosity: v[0] ?? 0 })}
            aria-label="粘性"
          />
        </ControlRow>

        <ControlRow label="波の強さ" value={settings.strength}>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[settings.strength]}
            onValueChange={(v) => patch({ strength: v[0] ?? 0 })}
            aria-label="波の強さ"
          />
        </ControlRow>

        <div className="mt-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle">
            カラーマップ
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="カラーマップ"
          >
            {COLORMAPS.map((map) => (
              <ColormapSwatch
                key={map.id}
                map={map}
                selected={settings.colormap === map.id}
                onSelect={(id) => patch({ colormap: id })}
              />
            ))}
          </div>
        </div>
      </aside>

      {hint ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center text-sm text-muted">
          ドラッグして波を起こす
        </p>
      ) : null}
    </div>
  );
}

function ControlRow({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-fg">{label}</span>
        <span className="font-mono text-xs tabular-nums text-subtle">
          {value}
        </span>
      </span>
      {children}
    </label>
  );
}

function ColormapSwatch({
  map,
  selected,
  onSelect,
}: {
  map: (typeof COLORMAPS)[number];
  selected: boolean;
  onSelect: (id: ColormapId) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={map.label}
      onClick={() => onSelect(map.id)}
      className={cn(
        "flex h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-md border px-1.5 transition-[border-color,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
        selected
          ? "border-fg bg-surface-2"
          : "border-border bg-transparent hover:border-border-strong",
      )}
    >
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: map.swatch }}
        aria-hidden
      />
      <span className="text-xs leading-none text-muted">{map.label}</span>
    </button>
  );
}

function AuthChip() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="size-11 animate-pulse rounded-md bg-surface" aria-hidden />
    );
  }
  if (!user) {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link to="/login">サインイン</Link>
      </Button>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "アカウント";
  return (
    <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface/88 px-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-7 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-medium">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="max-w-24 truncate text-xs font-medium">{label}</span>
      {authEnabled ? (
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          サインアウト
        </button>
      ) : null}
    </div>
  );
}
