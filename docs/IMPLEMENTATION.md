# LUMA dateback — dokumentacja implementacyjna (dla Claude)

Aplikacja do wypalania retro / fancy timestampów na zdjęciach. Makieta UI jest
zaimplementowana w TypeScript (React + TanStack Start + Tailwind v4). Ten
dokument opisuje architekturę, model danych i algorytmy, które należy
zaimplementować / rozbudować po stronie logiki.

## 1. Zakres produktu

1. Użytkownik wgrywa zdjęcie (drag & drop, file input, `capture` na mobile).
2. Wybiera preset stempla (5 stylów), pozycję, skalę, kolor i własną datę/czas.
3. Widzi podgląd na żywo (DOM overlay na zdjęciu).
4. Eksportuje PNG w **natywnej rozdzielczości** zdjęcia, bez watermarku.

Bez kont, bez backendu — całość działa client-side.

## 2. Mapa plików

| Plik | Rola |
| --- | --- |
| `src/lib/stamps.ts` | **Specyfikacja wykonywalna**: typy, presety, formatowanie tekstu, fonty canvas, kolory. Zmiany stylów tylko tutaj. |
| `src/routes/index.tsx` | Całe UI: upload, podgląd, presety, kontrolki, eksport canvas. |
| `src/styles.css` | Tokeny designu (`--cam-*`), fonty, animacje (`stampglow`, `flicker`, `rise`), scanlines. |

## 3. Model danych

```ts
type StampStyleId = "quartz" | "vhs" | "film" | "polaroid" | "exif";
type StampPosition = "TL" | "TR" | "BL" | "BR" | "CT" | "CB";
type StampColor = "amber" | "phosphor" | "cream";

interface StampConfig {
  style: StampStyleId;
  position: StampPosition;
  scale: number;   // 0.6–3.0, 1.0 ≈ 2.8% wysokości klatki
  color: StampColor;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
}
```

Każdy preset (`STAMP_PRESETS`) definiuje:

- `format(date, time): string[]` — linie tekstu stempla (np. VHS ma 2 linie),
- `canvasFont(px): string` — font dla `ctx.font` (VT323, IBM Plex Mono, Caveat),
- `glow: boolean` — czy na canvasie stosować `shadowBlur` (efekt podświetlonych cyfr).

## 4. Algorytm eksportu (canvas)

Zaimplementowany w `exportStamped` w `index.tsx`; docelowo wydziel do
`src/lib/render-stamp.ts`. Kroki:

1. `canvas.width/height = naturalWidth/naturalHeight` wgranego zdjęcia (nigdy CSS-owe!).
2. `ctx.drawImage(img, 0, 0, w, h)`.
3. `await document.fonts.ready` **przed** rysowaniem tekstu — inaczej canvas
   użyje fallback fontu. Fonty ładujemy z Google Fonts w `__root.tsx`; dla
   pewności można wymusić `document.fonts.load('32px VT323')` itd.
4. Wielkość fontu: `fontPx = round(h * 0.028 * config.scale)`.
5. Margines: `m = round(h * 0.02)`.
6. Pozycja:
   - `textAlign`: left/right/center zależnie od TL|BL / TR|BR / CT|CB,
   - `x = m | w - m | w/2`,
   - `y = m` (góra) lub `h - m - lineHeight * lines.length` (dół),
   - `textBaseline = "top"`, `lineHeight = fontPx * 1.15`.
7. Glow: `ctx.shadowColor = color; ctx.shadowBlur = round(fontPx * 0.35)`.
8. Eksport: `canvas.toDataURL("image/png")` → `<a download>`.

## 5. Spójność podglądu z eksportem

Podgląd (DOM) i eksport (canvas) muszą dawać ten sam tekst — dlatego
`format()` i `canvasFont()` żyją w `stamps.ts` i są współdzielone. Klasa
pozycji w DOM (`POSITION_CLASSES`) odpowiada obliczeniom x/y na canvasie.
Przy zmianach stylu edytuj **tylko** `stamps.ts`.

## 6. Zadania dla Claude (kolejność)

1. **Wydzielenie renderera** — przenieś logikę canvas z `index.tsx` do
   `src/lib/render-stamp.ts` jako czystą funkcję
   `renderStamp(img: HTMLImageElement, config: StampConfig): Promise<Blob>`.
   Użyj `canvas.toBlob()` zamiast `toDataURL` (mniejsze zużycie pamięci przy
   dużych zdjęciach).
2. **EXIF jako domyślna data** — przy uploadzie odczytaj
   `DateTimeOriginal` z EXIF (np. biblioteką `exifr`) i ustaw jako
   początkowe `date`/`time`; fallback = data modyfikacji pliku.
3. **Walidacja i błędy** — limit rozmiaru pliku (np. 30 MB), komunikat dla
   HEIC bez wsparcia, obsługa bardzo dużych rozdzielczości (limit canvas
   ~16384px w Safari — w razie potrzeby skaluj z ostrzeżeniem).
4. **Testy** — `vitest`: jednostkowe dla `format()` każdego presetu (stała
   data wejściowa → snapshot stringów) oraz dla obliczeń pozycji x/y.
5. **PWA / mobile capture** — `<input capture="environment">` na mobile,
   instalowalność, offline (fonty self-hosted przez `@fontsource`).

## 7. Konwencje i pułapki

- Kolory wyłącznie przez tokeny `--cam-*` / klasy `cam-*` (patrz `styles.css`).
- `URL.createObjectURL` — zawsze `revokeObjectURL` przy podmianie/unmount.
- Nie skaluj obrazu przy eksporcie do rozmiaru podglądu; podgląd jest
  `object-cover`, ale canvas rysuje pełną klatkę.
- Emoji/glyph `▶` w stylu VHS: na canvasie renderuj jako zwykły tekst
  (IBM Plex Mono zawiera ten glif; ewentualnie rysuj trójkąt ręcznie).
- Preset "polaroid" używa Caveat — czcionka odręczna, glow wyłączony.
