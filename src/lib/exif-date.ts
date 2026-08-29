/**
 * LUMA dateback — data zrobienia zdjęcia jako domyślna propozycja stempla.
 *
 * Best-effort: `DateTimeOriginal` z EXIF-u, z fallbackiem na datę modyfikacji
 * pliku (patrz docs/IMPLEMENTATION.md §6.2). Nigdy nie rzuca — brak/uszkodzony
 * EXIF (HEIC, PNG, screenshoty bez metadanych) nie może zablokować uploadu,
 * po prostu nie proponujemy wtedy nic lepszego niż datę modyfikacji.
 */

/** Zwraca datę zrobienia zdjęcia, albo null, jeśli nie da się jej w żaden sposób ustalić. */
export async function readCaptureDate(file: File): Promise<Date | null> {
  try {
    const exifr = await import("exifr");
    const tags = (await exifr.parse(file, ["DateTimeOriginal"])) as
      { DateTimeOriginal?: unknown } | undefined;
    const captured = tags?.DateTimeOriginal;
    if (captured instanceof Date && !Number.isNaN(captured.getTime())) {
      return captured;
    }
  } catch {
    // Nieobsługiwany/uszkodzony EXIF — spadamy do fallbacku poniżej.
  }

  if (file.lastModified) {
    const fallback = new Date(file.lastModified);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

/** Data lokalna w formacie inputa `<input type="date">` (YYYY-MM-DD). */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Czas lokalny w formacie inputa `<input type="time">` (HH:MM). */
export function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
