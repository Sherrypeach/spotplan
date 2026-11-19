import poppins400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import poppins600 from '@fontsource/poppins/files/poppins-latin-600-normal.woff2?url';
import poppinsExt400 from '@fontsource/poppins/files/poppins-latin-ext-400-normal.woff2?url';
import poppinsExt600 from '@fontsource/poppins/files/poppins-latin-ext-600-normal.woff2?url';

import { PRINT_PAGE } from '@modules/chart/sheetLayout';

// The file name says nothing about the class: only that it's a seating chart, and the day.
function fileName(extension: 'png' | 'pdf', at = new Date()): string {
  const day = [at.getFullYear(), at.getMonth() + 1, at.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
  return `seating-chart-${day}.${extension}`;
}
// A letter page in PDF points (72 to an inch), and its 10mm margin.
const LETTER_POINTS = { long: 792, short: 612 };
const PDF_MARGIN_POINTS = 28.35;
// The PDF's picture is a JPEG: a fraction of a PNG's size, still sharp on paper.
const JPEG_QUALITY = 0.92;
// The paper's margin when printing, drawn by the page itself so the browser adds no header or footer.
const PRINT_MARGIN = '10mm';
// The image is drawn at twice the sheet's size, so it stays sharp when printed or zoomed.
const IMAGE_SCALE = 2;
// Browsers start a download a moment after the click; the file's address must live that long.
const DOWNLOAD_GRACE_MS = 1000;

let fontFaces: Promise<string> | null = null;

async function asDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Poppins as @font-face rules with the fonts inlined: an SVG drawn as an image
 * can't reach the page's fonts, and would fall back to Arial.
 */
// The same letter sets the page's own Poppins covers: plain letters, and accented ones like Ł or Ş.
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const FACES = [
  { url: poppins400, weight: 400, range: LATIN },
  { url: poppins600, weight: 600, range: LATIN },
  { url: poppinsExt400, weight: 400, range: LATIN_EXT },
  { url: poppinsExt600, weight: 600, range: LATIN_EXT },
];

/** Starts loading the fonts the image and print need, so they're ready by the first click. */
export function preloadChartFonts(): void {
  void poppinsFaces();
}

function poppinsFaces(): Promise<string> {
  fontFaces ??= Promise.all(FACES.map((face) => asDataUrl(face.url)))
    .then((urls) =>
      FACES.map((face, index) => `@font-face{font-family:Poppins;font-weight:${face.weight};src:url(${urls[index]}) format('woff2');unicode-range:${face.range}}`).join(''),
    )
    .catch(() => {
      // A failed fetch (a blip offline) is tried again next time.
      fontFaces = null;
      return '';
    });
  return fontFaces;
}

/** A copy of the sheet that stands on its own: a real size, and the fonts inside it. */
async function standalone(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.removeAttribute('class');
  const faces = await poppinsFaces();
  if (faces) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = faces;
    copy.prepend(style);
  }
  return copy;
}

function loaded(image: HTMLImageElement): Promise<void> {
  return image.decode().catch(
    () =>
      new Promise<void>((resolve, reject) => {
        if (image.complete && image.naturalWidth > 0) return resolve();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('The chart picture could not be drawn.'));
      }),
  );
}

/** The sheet drawn on a canvas twice its size, then encoded. Throws when the browser can't make the picture. */
async function sheetPicture(svg: SVGSVGElement, type: 'image/png' | 'image/jpeg'): Promise<{ blob: Blob; width: number; height: number }> {
  const copy = await standalone(svg);
  const { width, height } = svg.viewBox.baseVal;
  const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = source;
    await loaded(image);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * IMAGE_SCALE);
    canvas.height = Math.round(height * IMAGE_SCALE);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The chart picture is too big for this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
    if (!blob) throw new Error('The chart picture could not be made.');
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(source);
  }
}

function download(blob: Blob, name: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, DOWNLOAD_GRACE_MS);
}

/** Downloads the chart as a PNG. Throws when the browser can't make the picture. */
export async function saveImage(svg: SVGSVGElement): Promise<void> {
  const { blob } = await sheetPicture(svg, 'image/png');
  download(blob, fileName('png'));
}

/**
 * A one-page PDF holding a JPEG picture, centered on a letter page turned to
 * fit it, inside the paper's margin.
 */
export function pdfWithPicture(jpeg: Uint8Array, width: number, height: number): Blob {
  const turn = pageTurn(width, height);
  const [pageWidth, pageHeight] = turn === 'landscape' ? [LETTER_POINTS.long, LETTER_POINTS.short] : [LETTER_POINTS.short, LETTER_POINTS.long];
  const fit = Math.min((pageWidth - PDF_MARGIN_POINTS * 2) / width, (pageHeight - PDF_MARGIN_POINTS * 2) / height);
  const [drawWidth, drawHeight] = [width * fit, height * fit];
  const [x, y] = [(pageWidth - drawWidth) / 2, (pageHeight - drawHeight) / 2];
  const draw = `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Chart Do Q`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: () => void) => {
    offsets.push(length);
    add(`${offsets.length} 0 obj\n`);
    body();
    add('\nendobj\n');
  };
  add('%PDF-1.4\n');
  object(() => add('<< /Type /Catalog /Pages 2 0 R >>'));
  object(() => add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  object(() => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Chart 4 0 R >> >> /Contents 5 0 R >>`));
  object(() => {
    add(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    add(jpeg);
    add('\nendstream');
  });
  object(() => add(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  const table = length;
  add(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Downloads the chart as a one-page PDF, ready to print or attach. Throws when the browser can't make the picture. */
export async function savePdf(svg: SVGSVGElement): Promise<void> {
  const { blob, width, height } = await sheetPicture(svg, 'image/jpeg');
  download(pdfWithPicture(new Uint8Array(await blob.arrayBuffer()), width, height), fileName('pdf'));
}

/** The page turned whichever way the sheet prints biggest. */
function pageTurn(width: number, height: number): 'landscape' | 'portrait' {
  const wide = Math.min(PRINT_PAGE.long / width, PRINT_PAGE.short / height);
  const tall = Math.min(PRINT_PAGE.short / width, PRINT_PAGE.long / height);
  return wide >= tall ? 'landscape' : 'portrait';
}

/**
 * Prints only the chart, from a frame the page never shows, on a page turned
 * to fit it. The chart is copied in as nodes, never re-read as HTML.
 */
export async function printSheet(svg: SVGSVGElement, onDone?: () => void): Promise<void> {
  document.querySelector('iframe[data-chart-print]')?.remove();
  const frame = document.createElement('iframe');
  frame.dataset.chartPrint = '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0' });
  document.body.append(frame);
  const page = frame.contentDocument;
  const view = frame.contentWindow;
  if (!page || !view) {
    frame.remove();
    return;
  }
  const { width, height } = svg.viewBox.baseVal;
  page.title = 'Seating chart';
  const style = page.createElement('style');
  // No page margin, so the browser prints no address or date around the chart; the body keeps the paper's edge.
  style.textContent = `@page{size:${pageTurn(width, height)};margin:0}html,body{margin:0;height:100%}body{box-sizing:border-box;padding:${PRINT_MARGIN};overflow:hidden}svg{display:block;width:100%;height:100%}`;
  page.head.append(style);
  const copy = await standalone(svg);
  copy.setAttribute('width', '100%');
  copy.setAttribute('height', '100%');
  page.body.append(page.importNode(copy, true));
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };
  view.addEventListener('afterprint', finish, { once: true });
  // The inlined fonts load before printing, or the first print comes out in Arial.
  if (page.fonts) {
    await Promise.all([page.fonts.load('400 20px Poppins'), page.fonts.load('600 20px Poppins')]).catch(() => undefined);
    await page.fonts.ready;
  }
  view.focus();
  view.print();
  // Most browsers wait in print() until the dialog closes; the others say so with afterprint.
  finish();
}

/** Whether this browser can show an element full screen (iPhone Safari can't). */
export function canFullscreen(): boolean {
  return Boolean(document.fullscreenEnabled);
}
