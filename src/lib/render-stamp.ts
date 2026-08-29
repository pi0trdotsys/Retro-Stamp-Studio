/**
 * LUMA dateback — renderer eksportu (canvas → PNG).
 *
 * Wydzielone z routes/index.tsx zgodnie z docs/IMPLEMENTATION.md §6.1:
 * czysta funkcja, `canvas.toBlob()` zamiast `toDataURL()` (mniejsze zużycie
 * pamięci przy dużych zdjęciach, i to właśnie Blob jest tym, co potem trafia
 * albo do `<a download>` (web), albo do Filesystem+Share (Capacitor/native).
 */
import { getPreset, STAMP_COLORS, type StampConfig } from "./stamps";

export class StampRenderError extends Error {}

/**
 * Rysuje źródłowe zdjęcie + stempel na canvasie w natywnej rozdzielczości
 * zdjęcia (nigdy w rozmiarze CSS podglądu) i zwraca wynik jako PNG Blob.
 *
 * Wymaga, żeby `source` był już w pełni załadowany (`complete` / `onload`
 * odpalone) — inaczej `naturalWidth/Height` będą zerowe.
 */
export async function renderStamp(source: HTMLImageElement, config: StampConfig): Promise<Blob> {
  if (!source.naturalWidth || !source.naturalHeight) {
    throw new StampRenderError("Zdjęcie źródłowe nie jest jeszcze załadowane.");
  }

  // Canvas może użyć fallbackowego fontu, jeśli docelowy jeszcze się ładuje —
  // fonty ładujemy z Google Fonts w __root.tsx, więc czekamy, aż będą gotowe.
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new StampRenderError("Canvas 2D nie jest dostępny w tej przeglądarce.");

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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new StampRenderError(
      "Nie udało się wyeksportować obrazu (canvas.toBlob zwrócił null) — zdjęcie może być za duże.",
    );
  }
  return blob;
}

/** Blob → czysty base64 (bez prefiksu `data:...;base64,`), do zapisu przez Capacitor Filesystem. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new StampRenderError("Nie udało się odczytać wyeksportowanego obrazu."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new StampRenderError("Odczyt Blob nie powiódł się."));
    reader.readAsDataURL(blob);
  });
}
