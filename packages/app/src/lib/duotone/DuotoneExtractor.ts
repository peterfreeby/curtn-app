type RGB = [number, number, number];
type Bucket = { color: RGB; count: number };

export class DuotoneExtractor {
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  constructor() {
    this.offscreen = document.createElement("canvas");
    this.offCtx = this.offscreen.getContext("2d", {
      willReadFrequently: true,
    })!;
  }

  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load: " + src));
      img.src = src;
    });
  }

  private samplePixels(imageData: ImageData, sampleRate = 4): RGB[] {
    const pixels: RGB[] = [];
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4 * sampleRate) {
      pixels.push([d[i], d[i + 1], d[i + 2]]);
    }
    return pixels;
  }

  private medianCut(pixels: RGB[], depth = 3): Bucket[] {
    if (depth === 0 || pixels.length === 0) {
      const avg: RGB = [0, 0, 0];
      for (const p of pixels) {
        avg[0] += p[0];
        avg[1] += p[1];
        avg[2] += p[2];
      }
      const n = pixels.length || 1;
      return [
        {
          color: [
            Math.round(avg[0] / n),
            Math.round(avg[1] / n),
            Math.round(avg[2] / n),
          ],
          count: n,
        },
      ];
    }

    const ranges = [0, 1, 2].map((ch) => {
      let min = 255,
        max = 0;
      for (const p of pixels) {
        min = Math.min(min, p[ch]);
        max = Math.max(max, p[ch]);
      }
      return max - min;
    });
    const splitCh = ranges.indexOf(Math.max(...ranges));

    pixels.sort((a, b) => a[splitCh] - b[splitCh]);
    const mid = Math.floor(pixels.length / 2);

    return [
      ...this.medianCut(pixels.slice(0, mid), depth - 1),
      ...this.medianCut(pixels.slice(mid), depth - 1),
    ];
  }

  private colorDistance(a: RGB, b: RGB): number {
    const dr = (a[0] - b[0]) * 0.3;
    const dg = (a[1] - b[1]) * 0.59;
    const db = (a[2] - b[2]) * 0.11;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private getDominantTwo(pixels: RGB[]): [RGB, RGB] {
    const buckets = this.medianCut(pixels, 3);
    buckets.sort((a, b) => b.count - a.count);

    let colorA = buckets[0].color;
    let colorB: RGB | null = null;

    for (let i = 1; i < buckets.length; i++) {
      const dist = this.colorDistance(colorA, buckets[i].color);
      if (dist > 80) {
        colorB = buckets[i].color;
        break;
      }
    }

    if (!colorB) {
      let maxDist = 0;
      for (let i = 1; i < buckets.length; i++) {
        const dist = this.colorDistance(colorA, buckets[i].color);
        if (dist > maxDist) {
          maxDist = dist;
          colorB = buckets[i].color;
        }
      }
    }

    if (!colorB) colorB = colorA;

    // Darker color first (background), lighter second (foreground)
    const lumA = colorA[0] * 0.299 + colorA[1] * 0.587 + colorA[2] * 0.114;
    const lumB = colorB[0] * 0.299 + colorB[1] * 0.587 + colorB[2] * 0.114;
    if (lumA > lumB) [colorA, colorB] = [colorB, colorA];

    return [colorA, colorB];
  }

  private remapDuotone(
    imageData: ImageData,
    colorA: RGB,
    colorB: RGB
  ): ImageData {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum =
        (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      d[i] = colorA[0] + (colorB[0] - colorA[0]) * lum;
      d[i + 1] = colorA[1] + (colorB[1] - colorA[1]) * lum;
      d[i + 2] = colorA[2] + (colorB[2] - colorA[2]) * lum;
    }
    return imageData;
  }

  async process(
    canvas: HTMLCanvasElement,
    src: string
  ): Promise<{ colorA: RGB; colorB: RGB }> {
    const img = await this.loadImage(src);

    const parent = canvas.parentElement;
    const w = parent ? parent.offsetWidth : 200;
    const h = parent ? parent.offsetHeight : w * 1.5;
    canvas.width = w;
    canvas.height = h;

    // Cover-crop logic
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = w / h;
    let sx = 0,
      sy = 0,
      sw = img.naturalWidth,
      sh = img.naturalHeight;
    if (imgAspect > canvasAspect) {
      sw = img.naturalHeight * canvasAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / canvasAspect;
      sy = (img.naturalHeight - sh) / 2;
    }

    this.offscreen.width = w;
    this.offscreen.height = h;
    this.offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    let imageData = this.offCtx.getImageData(0, 0, w, h);
    const pixels = this.samplePixels(imageData, 3);
    const [colorA, colorB] = this.getDominantTwo(pixels);

    // Re-draw for final duotone
    this.offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    imageData = this.offCtx.getImageData(0, 0, w, h);
    this.remapDuotone(imageData, colorA, colorB);

    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);

    return { colorA, colorB };
  }
}
