import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_STAMP,
  STAMP_COLORS,
  STAMP_PRESETS,
  getPreset,
  type StampColor,
  type StampConfig,
  type StampPosition,
} from "@/lib/stamps";
import heroPhoto from "@/assets/hero-photo.jpg";
import beforeThumb from "@/assets/before-thumb.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LUMA dateback — retro timestampy na zdjęciach" },
      {
        name: "description",
        content:
          "Wypal retro stemple daty na zdjęciach: orange quartz, VHS PLAY OSD, film edge, Polaroid hand, terminal EXIF. Eksport PNG w pełnej rozdzielczości.",
      },
      { property: "og:title", content: "LUMA dateback — retro timestampy na zdjęciach" },
      {
        property: "og:description",
        content:
          "Wypal retro stemple daty na zdjęciach: orange quartz, VHS PLAY OSD, film edge, Polaroid hand, terminal EXIF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const POSITIONS: StampPosition[] = ["TL", "TR", "BL", "BR", "CT", "CB"];

const POSITION_CLASSES: Record<StampPosition, string> = {
  TL: "left-3 top-3 text-left",
  TR: "right-3 top-3 text-right",
  BL: "left-3 bottom-3 text-left",
  BR: "right-3 bottom-3 text-right",
  CT: "left-1/2 top-3 -translate-x-1/2 text-center",
  CB: "left-1/2 bottom-3 -translate-x-1/2 text-center",
};

function StampOverlay({ config }: { config: StampConfig }) {
  const preset = getPreset(config.style);
  const lines = preset.format(config.date, config.time);
  const color = STAMP_COLORS[config.color];
  const basePx = 16 * config.scale;

  const fontFamily =
    config.style === "quartz"
      ? "var(--font-pixel)"
      : config.style === "polaroid"
        ? "var(--font-hand)"
        : "var(--font-mono)";

  return (
    <div
      className={`pointer-events-none absolute ${POSITION_CLASSES[config.position]} ${
        preset.glow ? "animate-stampglow" : ""
      }`}
      style={{
        color,
        fontFamily,
        fontSize: `${basePx}px`,
        lineHeight: 1.15,
        letterSpacing: config.style === "film" ? "0.15em" : "0.04em",
        textTransform: config.style === "film" ? "uppercase" : "none",
      }}
    >
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

// Exported (not just used as the route's `component`) so the standalone
// Capacitor/APK entry (apk/main.tsx) can render the exact same screen
// client-side, with no TanStack Router/Start involved.
export function Index() {
  const [config, setConfig] = useState<StampConfig>(DEFAULT_STAMP);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("IMG_0014.jpg");
  const [photoDims, setPhotoDims] = useState("1080×1350");
  const [dragOver, setDragOver] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoName(file.name);
    const img = new Image();
    img.onload = () => setPhotoDims(`${img.naturalWidth}×${img.naturalHeight}`);
    img.src = url;
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  /** Eksport: rysuje zdjęcie + stempel na canvasie w natywnej rozdzielczości. */
  const exportStamped = useCallback(async () => {
    const source = imageRef.current;
    if (!source) return;

    await document.fonts.ready;

    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const preset = getPreset(config.style);
    const lines = preset.format(config.date, config.time);
    const margin = Math.round(canvas.height * 0.02);
    const fontPx = Math.round(canvas.height * 0.028 * config.scale);

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
    const x = isLeft ? margin : isRight ? canvas.width - margin : canvas.width / 2;
    const y = isTop ? margin : canvas.height - margin - blockHeight;

    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight);
    });

    const link = document.createElement("a");
    link.download = photoName.replace(/\.[^.]+$/, "") + "_stamped.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [config, photoName]);

  const set = <K extends keyof StampConfig>(key: K, value: StampConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="min-h-screen bg-background text-cam-cream font-mono selection:bg-cam-amber selection:text-cam-bg">
      {/* sticky nav — extra top padding accounts for the status bar / notch when
          running edge-to-edge in the Capacitor Android shell; env() resolves to 0
          in regular browsers (no viewport-fit=cover there), so the website is unaffected */}
      <header
        className="sticky top-0 z-20 border-b border-cam-line bg-background/90"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-cam-amber font-display font-bold tracking-tight text-lg">
              LUMA
            </span>
            <span className="text-cam-dim text-[10px] uppercase tracking-[0.2em]">dateback</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-cam-dim">
            <span className="text-cam-phosphor">REC</span> · 35MM ·{" "}
            <span className="text-cam-amber">CAM_01</span>
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-md px-4 pb-10 space-y-4"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* (a) source */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-cam-dim pt-3 animate-rise">
          <span>(a) SOURCE</span>
          <span className="text-cam-phosphor">FRAME 001</span>
        </div>

        {/* hero canvas */}
        <section className="animate-rise [animation-delay:60ms]">
          <div
            className={`relative rounded-[10px] overflow-hidden ring-1 transition-colors ${
              dragOver ? "ring-cam-amber" : "ring-black/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) loadFile(file);
            }}
          >
            {photoUrl ? (
              <img
                ref={imageRef}
                src={photoUrl}
                alt="Wgrane zdjęcie z nałożonym stemplem"
                className="w-full aspect-[4/5] object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <img
                ref={imageRef}
                src={heroPhoto}
                alt="Przykładowe zdjęcie ulicy w deszczu z nałożonym retro stemplem daty"
                width={1080}
                height={1350}
                className="w-full aspect-[4/5] object-cover"
              />
            )}
            <div className="absolute inset-0 bg-scan pointer-events-none" />
            <div className="absolute inset-0 bg-black/10 pointer-events-none animate-flicker" />
            <StampOverlay config={config} />
          </div>

          {/* upload state */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 w-full flex items-center gap-3 rounded-[8px] border border-dashed border-cam-line px-3 py-2 text-left cursor-pointer hover:border-cam-amber transition-colors"
          >
            <span className="size-2 rounded-full bg-cam-amber animate-stampglow" />
            <span className="text-[11px] text-cam-dim">
              <span className="text-cam-cream">{photoName}</span> · {photoDims} ·{" "}
              <span className="text-cam-amber">STAMPED</span>
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.15em] text-cam-dim">
              drop / capture
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
            }}
          />
        </section>

        {/* (b) film-strip presets */}
        <div className="flex items-center justify-between pt-2 text-[10px] uppercase tracking-[0.15em] text-cam-dim">
          <span>(b) STAMP STYLE</span>
          <span className="text-cam-phosphor">05 LOADED</span>
        </div>
        <section className="flex gap-2 -mx-4 px-4 overflow-x-auto pb-1">
          {STAMP_PRESETS.map((preset, i) => {
            const active = preset.id === config.style;
            const previewLines = preset.format(config.date, config.time);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => set("style", preset.id)}
                className={`shrink-0 w-[112px] rounded-[8px] bg-cam-panel p-2 text-left cursor-pointer animate-rise ${
                  active ? "ring-2 ring-cam-amber" : "ring-1 ring-cam-line"
                }`}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <div
                  className={`aspect-[4/3] rounded-[5px] grid place-items-center mb-2 px-1 text-center ${
                    preset.id === "polaroid" ? "bg-cam-cream" : "bg-cam-bg"
                  }`}
                >
                  <span
                    className={preset.id === "quartz" ? "seg text-lg" : "text-[11px] leading-tight"}
                    style={{
                      fontFamily:
                        preset.id === "polaroid" ? "var(--font-hand)" : undefined,
                      fontSize: preset.id === "polaroid" ? 15 : undefined,
                      color:
                        preset.id === "polaroid"
                          ? "#2a2318"
                          : preset.id === "quartz" || preset.id === "film"
                            ? STAMP_COLORS.amber
                            : STAMP_COLORS.phosphor,
                    }}
                  >
                    {previewLines.map((l, j) => (
                      <span key={j} className="block">
                        {l}
                      </span>
                    ))}
                  </span>
                </div>
                <p
                  className={`text-[10px] leading-tight ${
                    active ? "text-cam-cream" : "text-cam-dim"
                  }`}
                >
                  {preset.label}
                  <br />
                  {preset.sublabel}
                </p>
              </button>
            );
          })}
        </section>

        {/* (c) control tray */}
        <div className="flex items-center justify-between pt-2 text-[10px] uppercase tracking-[0.15em] text-cam-dim">
          <span>(c) CONTROLS</span>
        </div>
        <section className="rounded-[10px] bg-cam-panel ring-1 ring-cam-line p-3 space-y-3 animate-rise [animation-delay:200ms]">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-cam-dim mb-1">Position</p>
              <div className="grid grid-cols-3 gap-1">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => set("position", pos)}
                    className={`py-1.5 text-[11px] rounded cursor-pointer ${
                      config.position === pos
                        ? "bg-cam-amber text-cam-bg"
                        : "ring-1 ring-cam-line text-cam-dim"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-cam-dim mb-1">Size</p>
              <input
                type="range"
                min={0.6}
                max={3}
                step={0.1}
                value={config.scale}
                onChange={(e) => set("scale", Number(e.target.value))}
                className="w-full accent-cam-amber h-1 cursor-pointer"
              />
              <p className="text-[10px] text-cam-amber mt-1">× {config.scale.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-cam-dim mb-1">Color</p>
              <div className="flex gap-1.5">
                {(Object.keys(STAMP_COLORS) as StampColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Kolor ${c}`}
                    onClick={() => set("color", c)}
                    className={`size-5 rounded cursor-pointer ${
                      config.color === c ? "ring-2 ring-cam-cream/60" : ""
                    }`}
                    style={{ backgroundColor: STAMP_COLORS[c] }}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* custom date */}
          <div className="pt-1 border-t border-cam-line">
            <p className="text-[10px] uppercase tracking-[0.15em] text-cam-dim mb-1.5">
              Custom date / time
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="date"
                value={config.date}
                onChange={(e) => set("date", e.target.value)}
                className="flex-1 min-w-0 bg-background ring-1 ring-cam-line rounded px-2 py-2 text-[12px] text-cam-cream [color-scheme:dark]"
              />
              <input
                type="time"
                value={config.time}
                onChange={(e) => set("time", e.target.value)}
                className="w-24 bg-background ring-1 ring-cam-line rounded px-2 py-2 text-[12px] text-cam-cream [color-scheme:dark]"
              />
            </div>
          </div>
        </section>

        {/* (d) export */}
        <section className="animate-rise [animation-delay:280ms]">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-cam-dim mb-1.5">
            <span>(d) EXPORT PREVIEW</span>
            <span>
              <span className="text-cam-dim">BEFORE</span> /{" "}
              <span className="text-cam-amber">AFTER</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative rounded-[8px] overflow-hidden ring-1 ring-cam-line">
              <img
                src={photoUrl ?? beforeThumb}
                alt="Zdjęcie przed nałożeniem stempla"
                loading="lazy"
                className="w-full aspect-square object-cover"
              />
            </div>
            <div className="relative rounded-[8px] overflow-hidden ring-1 ring-cam-amber">
              <img
                src={photoUrl ?? beforeThumb}
                alt="Zdjęcie po nałożeniu stempla"
                loading="lazy"
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0">
                <StampOverlay config={{ ...config, scale: config.scale * 0.55 }} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={exportStamped}
            className="mt-3 w-full py-3 rounded-[8px] bg-cam-amber text-cam-bg font-display font-bold text-sm uppercase tracking-[0.1em] cursor-pointer hover:brightness-110 transition"
          >
            Export stamped photo
          </button>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.15em] text-cam-dim">
            PNG · {photoDims} · no watermark
          </p>
        </section>
      </main>
    </div>
  );
}
