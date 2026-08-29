/**
 * LUMA dateback — definicje stylów stempli.
 *
 * Ten plik jest „specyfikacją wykonywalną": każdy preset opisuje,
 * jak timestamp ma wyglądać na podglądzie (DOM) i na eksporcie (canvas).
 * Szczegóły implementacji logiki: docs/IMPLEMENTATION.md.
 */

export type StampStyleId =
  | "quartz"
  | "vhs"
  | "film"
  | "polaroid"
  | "exif"
  | "digicam"
  | "typewriter"
  | "gameboy"
  | "receipt";

export type StampPosition = "TL" | "TR" | "BL" | "BR" | "CT" | "CB";

export type StampColor = "amber" | "phosphor" | "cream";

export interface StampConfig {
  style: StampStyleId;
  position: StampPosition;
  /** Mnożnik skali względem bazowej wielkości (1.0 = ~3.5% wysokości klatki) */
  scale: number;
  color: StampColor;
  /** Data i czas do wypalenia na zdjęciu */
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export const STAMP_COLORS: Record<StampColor, string> = {
  amber: "#ff9e3d",
  phosphor: "#bde39a",
  cream: "#f2e6cf",
};

export interface StampPreset {
  id: StampStyleId;
  label: string;
  sublabel: string;
  /** Formatowanie tekstu stempla na podstawie daty/czasu */
  format: (date: string, time: string) => string[];
  /** Rodzina fontu używana na canvasie (musi być załadowana przed eksportem) */
  canvasFont: (px: number) => string;
  /** Czy stosować efekt „glow" (shadowBlur) na canvasie */
  glow: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDate(date: string): { y: string; yy: string; m: string; d: string } {
  const [y = "1996", m = "12", d = "04"] = date.split("-");
  return { y, yy: y.slice(-2), m, d };
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "HH:MM" (24h) → zegar 12-godzinny z AM/PM, np. "6:52 PM". */
function to12h(time: string): { h12: string; mm: string; period: "AM" | "PM" } {
  const [hStr = "0", mm = "00"] = time.split(":");
  const h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return { h12: String(h12), mm, period };
}

export const STAMP_PRESETS: StampPreset[] = [
  {
    id: "quartz",
    label: "Orange",
    sublabel: "Quartz",
    format: (date, time) => {
      const { yy, m, d } = parseDate(date);
      return [`'${yy} ${m} ${d} ${time}`];
    },
    canvasFont: (px) => `${px}px VT323, monospace`,
    glow: true,
  },
  {
    id: "vhs",
    label: "VHS",
    sublabel: "PLAY OSD",
    format: (date, time) => {
      const { yy, m, d } = parseDate(date);
      return ["▶ PLAY   SP 0:00:00", `${m}/${d}/${yy}  ${time}`];
    },
    canvasFont: (px) => `bold ${Math.round(px * 0.62)}px "IBM Plex Mono", monospace`,
    glow: false,
  },
  {
    id: "film",
    label: "Film",
    sublabel: "Edge",
    format: (date, time) => {
      const { y, m, d } = parseDate(date);
      return [`KODAK 400TX · ${y}-${m}-${d} ${time}`];
    },
    canvasFont: (px) => `500 ${Math.round(px * 0.55)}px "IBM Plex Mono", monospace`,
    glow: false,
  },
  {
    id: "polaroid",
    label: "Polaroid",
    sublabel: "Hand",
    format: (date, time) => {
      const { yy, m, d } = parseDate(date);
      return [`${d}.${m}.${yy} — ${time}`];
    },
    canvasFont: (px) => `700 ${px}px Caveat, cursive`,
    glow: false,
  },
  {
    id: "exif",
    label: "Terminal",
    sublabel: "EXIF",
    format: (date, time) => {
      const { y, m, d } = parseDate(date);
      return ["f/2.8  1/125  ISO 1600", `${y}-${m}-${d} ${time}`];
    },
    canvasFont: (px) => `${Math.round(px * 0.5)}px "IBM Plex Mono", monospace`,
    glow: true,
  },
  {
    id: "digicam",
    label: "Digicam",
    sublabel: "Y.M.D",
    format: (date, time) => {
      const { y, m, d } = parseDate(date);
      return [`${y}.${m}.${d}  ${time}`];
    },
    canvasFont: (px) => `${Math.round(px * 0.5)}px "IBM Plex Mono", monospace`,
    glow: false,
  },
  {
    id: "typewriter",
    label: "Typewriter",
    sublabel: "Journal",
    format: (date, time) => {
      const { y, m, d } = parseDate(date);
      const month = MONTHS_EN[Math.min(Math.max(Number(m) - 1, 0), 11)];
      const { h12, mm, period } = to12h(time);
      return [`${month}. ${Number(d)}, ${y} — ${h12}:${mm} ${period}`];
    },
    canvasFont: (px) => `${Math.round(px * 0.6)}px "Space Mono", monospace`,
    glow: false,
  },
  {
    id: "gameboy",
    label: "Pixel LCD",
    sublabel: "Handheld",
    format: (date, time) => {
      const { yy, m, d } = parseDate(date);
      return [`${d}/${m}/${yy}`, time];
    },
    canvasFont: (px) => `${Math.round(px * 1.05)}px VT323, monospace`,
    glow: true,
  },
  {
    id: "receipt",
    label: "Receipt",
    sublabel: "Thermal",
    format: (date, time) => {
      const { y, m, d } = parseDate(date);
      return [`* * ${y}-${m}-${d} ${time} * *`];
    },
    canvasFont: (px) => `${Math.round(px * 0.55)}px "IBM Plex Mono", monospace`,
    glow: false,
  },
];

export function getPreset(id: StampStyleId): StampPreset {
  return STAMP_PRESETS.find((p) => p.id === id) ?? STAMP_PRESETS[0]!;
}

/** Domyślna konfiguracja zgodna z makietą */
export const DEFAULT_STAMP: StampConfig = {
  style: "quartz",
  position: "BL",
  scale: 1.4,
  color: "amber",
  date: "1996-12-04",
  time: "18:52",
};
