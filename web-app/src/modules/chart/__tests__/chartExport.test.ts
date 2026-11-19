// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pdfWithPicture, saveImage } from '@modules/chart/chartExport';

function sheet(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1200 800');
  return svg;
}

describe('saving the chart as a picture', () => {
  const clicked: HTMLAnchorElement[] = [];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['font']))));
    URL.createObjectURL = vi.fn(() => 'blob:chart');
    URL.revokeObjectURL = vi.fn();
    HTMLImageElement.prototype.decode = () => Promise.resolve();
    HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => {} })) as unknown as HTMLCanvasElement['getContext'];
    HTMLCanvasElement.prototype.toBlob = function toBlob(done: BlobCallback) {
      done(new Blob(['png'], { type: 'image/png' }));
    };
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clicked.length = 0;
  });

  it('downloads a PNG with a name that says nothing about the team, then lets go of it', async () => {
    await saveImage(sheet());
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/^seating-chart-\d{4}-\d{2}-\d{2}\.png$/);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('says so when the browser can’t draw the picture', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
    await expect(saveImage(sheet())).rejects.toThrow('too big');
  });
});

function asText(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

describe('saving the chart as a PDF', () => {
  it('writes one letter page, turned to fit, with the picture and a table of where each part starts', async () => {
    // Plain letters stand in for the picture, so byte offsets match the text.
    const jpeg = new TextEncoder().encode('picture');
    const text = await asText(pdfWithPicture(jpeg, 3200, 2000));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 792 612]');
    expect(text).toContain('/Width 3200 /Height 2000');
    const table = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(table, table + 4)).toBe('xref');
    expect(await asText(pdfWithPicture(jpeg, 1000, 1600))).toContain('/MediaBox [0 0 612 792]');
  });
});
