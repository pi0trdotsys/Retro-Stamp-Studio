/**
 * LUMA dateback — czysty renderer klatki (zdjęcie + efekty + stempel + tryb termiczny).
 * Używany zarówno przez podgląd (mały canvas), jak i eksport (natywna rozdzielczość).
 */

import { STAMP_COLORS, getPreset, type StampConfig } from "./stamps";

export type DitherMode = "off" | "threshold" | "bayer" | "floyd" | "atkinson";

export interface EffectConfig {
  /** 0–100 — intensywność ziarna */
  grain: number;
  /** 0–100 — siła winiety */
  vignette: number;
  /** 0.5–2.0 */
  contrast: number;
  /** -50..50 */
  brightness: number;
  /** 0–100 — sepia / warm fade */
  fade: number;
  /** light leak w rogu */
  lightLeak: boolean;
  /** halacja wokół świateł (miękki bloom) */
  bloom: boolean;
}

export const DEFAULT_EFFECTS: EffectConfig = {
  grain: 18,
  vignette: 25,
  contrast: 1,
  brightness: 0,
  fade: 0,
  lightLeak: false,
  bloom: false,
};

export interface ThermalConfig {
  enabled: boolean;
  dither: DitherMode;
  /** szerokość druku w pikselach głowicy (58 mm ≈ 384, 80 mm ≈ 576) */
  printWidth: number;
  /** próg 0–255 dla threshold/bayer */
  threshold: number;
  invert: boolean;
}

export const DEFAULT_THERMAL: ThermalConfig = {
  enabled: false,
  dither: "atkinson",
  printWidth: 384,
  threshold: 128,
  invert: false,
};

export interface RenderOptions {
  config: StampConfig;
  effects: EffectConfig;
  thermal: ThermalConfig;
  /** maksymalna szerokość wyniku (podgląd); brak = natywna */
  maxWidth?: number;
}

const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, config: StampConfig) {
  const preset = getPreset(config.style);
  const lines = preset.format(config.date, config.time);
  const margin = Math.round(h * 0.02);
  const fontPx = Math.max(8, Math.round(h * 0.028 * config.scale));

  ctx.save();
  ctx.font = preset.canvasFont(fontPx);
  ctx.fillStyle = STAMP_COLORS[config.color];
  ctx.textBaseline = "top";
  if (preset.glow) {
    ctx.shadowColor = STAMP_COLORS[config.color];
    ctx.shadowBlur = Math.round(fontPx * 0.35);
  }

  const lineHeight = fontPx * 1.15;
  const blockHeight = lineHeight * lines.length;
  const isLeft = config.position === "TL" || config.position === "BL";
  const isRight = config.position === "TR" || config.position === "BR";
  const isTop = config.position === "TL" || config.position === "TR" || config.position === "CT";

  ctx.textAlign = isLeft ? "left" : isRight ? "right" : "center";
  const x = isLeft ? margin : isRight ? w - margin : w / 2;
  const y = isTop ? margin : h - margin - blockHeight;

  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  ctx.restore();
}

function applyPixelEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fx: EffectConfig,
) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const c = fx.contrast;
  const b = fx.brightness * 2.55;
  const fade = fx.fade / 100;
  const grain = fx.grain / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i]! - 128) * c + 128 + b;
    let g = (d[i + 1]! - 128) * c + 128 + b;
    let bl = (d[i + 2]! - 128) * c + 128 + b;

    if (fade > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = r + (lum * 1.07 - r) * fade;
      g = g + (lum * 0.96 - g) * fade;
      bl = bl + (lum * 0.82 - bl) * fade;
      // podniesione czernie (matowy fade)
      r = r * (1 - 0.12 * fade) + 26 * fade;
      g = g * (1 - 0.12 * fade) + 24 * fade;
      bl = bl * (1 - 0.12 * fade) + 22 * fade;
    }

    if (grain > 0) {
      const n = (Math.random() - 0.5) * 90 * grain;
      r += n;
      g += n;
      bl += n;
    }

    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
  }
  ctx.putImageData(image, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  if (strength <= 0) return;
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.28,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${(strength / 100) * 0.9})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function applyLightLeak(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(w, 0, w * 0.35, h * 0.6);
  grad.addColorStop(0, "rgba(255,138,40,0.55)");
  grad.addColorStop(0.45, "rgba(255,84,40,0.18)");
  grad.addColorStop(1, "rgba(255,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function applyBloom(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.filter = `blur(${Math.max(2, Math.round(h * 0.012))}px) brightness(1.25) contrast(1.6)`;
  tctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.35;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

/** Konwersja do 1-bitowej czerni i bieli — pod drukarkę termiczną. */
function applyThermal(ctx: CanvasRenderingContext2D, w: number, h: number, t: ThermalConfig) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const gray = new Float32Array(w * h);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  }

  const put = (p: number, v: number) => {
    const val = t.invert ? 255 - v : v;
    d[p * 4] = val;
    d[p * 4 + 1] = val;
    d[p * 4 + 2] = val;
    d[p * 4 + 3] = 255;
  };

  if (t.dither === "threshold" || t.dither === "bayer") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const bias =
          t.dither === "bayer" ? (BAYER8[y % 8]![x % 8]! / 64) * 255 - 127.5 : 0;
        put(p, gray[p]! + bias >= t.threshold ? 255 : 0);
      }
    }
  } else {
    // error diffusion
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const old = gray[p]!;
        const nv = old >= 128 ? 255 : 0;
        const err = old - nv;
        put(p, nv);
        const spread = (dx: number, dy: number, f: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
          gray[ny * w + nx] = gray[ny * w + nx]! + err * f;
        };
        if (t.dither === "floyd") {
          spread(1, 0, 7 / 16);
          spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16);
          spread(1, 1, 1 / 16);
        } else {
          const f = 1 / 8;
          spread(1, 0, f);
          spread(2, 0, f);
          spread(-1, 1, f);
          spread(0, 1, f);
          spread(1, 1, f);
          spread(0, 2, f);
        }
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number, invert: boolean) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

/** Renderuje pełną klatkę na nowym canvasie. */
export function renderStamped(
  source: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number },
  { config, effects, thermal, maxWidth }: RenderOptions,
): HTMLCanvasElement {
  const srcW = source.naturalWidth ?? (source.width as number) ?? 0;
  const srcH = source.naturalHeight ?? 0;

  let w = srcW;
  let h = srcH;
  const target = thermal.enabled ? Math.min(thermal.printWidth, maxWidth ?? thermal.printWidth) : maxWidth;
  if (target && w > target) {
    h = Math.round((h * target) / w);
    w = target;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (effects.bloom) applyBloom(ctx, canvas.width, canvas.height);
  applyPixelEffects(ctx, canvas.width, canvas.height, effects);
  if (effects.lightLeak) applyLightLeak(ctx, canvas.width, canvas.height);
  applyVignette(ctx, canvas.width, canvas.height, effects.vignette);

  drawStamp(ctx, canvas.width, canvas.height, config);

  if (thermal.enabled && thermal.dither !== "off") {
    applyThermal(ctx, canvas.width, canvas.height, thermal);
  } else if (thermal.enabled) {
    toGrayscale(ctx, canvas.width, canvas.height, thermal.invert);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
