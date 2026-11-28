export interface PdfDocumentController {
  pageCount: number;
  renderPageToCanvas: (pageNumber: number, canvas: HTMLCanvasElement, scale?: number) => Promise<void>;
  cropNormalizedBox: (
    pageNumber: number,
    box2d: [number, number, number, number], // [ymin, xmin, ymax, xmax] in 0..1000
    scale?: number
  ) => Promise<{ blob: Blob; previewUrl: string }>;
  toBase64: () => Promise<string>;
  destroy: () => void;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrlMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

export async function loadPdfDocumentController(file: File): Promise<PdfDocumentController> {
  const pdfjs = await getPdfJs();
  const rawBuffer = await file.arrayBuffer();
  // Clone buffer because pdf.js worker transfers/detaches the ArrayBuffer!
  const bufferForBase64 = rawBuffer.slice(0);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(rawBuffer) });
  const pdfDoc = await loadingTask.promise;

  // Cache rendered offscreen canvases at scale 2.0 for fast multi-figure cropping
  const offscreenCache = new Map<string, HTMLCanvasElement>();

  async function getRenderedCanvas(pageNumber: number, scale = 2.0): Promise<HTMLCanvasElement> {
    const clampedPage = Math.min(Math.max(1, pageNumber), pdfDoc.numPages);
    const cacheKey = `${clampedPage}@${scale}`;
    if (offscreenCache.has(cacheKey)) {
      return offscreenCache.get(cacheKey)!;
    }

    const page = await pdfDoc.getPage(clampedPage);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    offscreenCache.set(cacheKey, canvas);
    return canvas;
  }

  return {
    pageCount: pdfDoc.numPages,

    async renderPageToCanvas(pageNumber: number, targetCanvas: HTMLCanvasElement, scale = 1.45) {
      const clampedPage = Math.min(Math.max(1, pageNumber), pdfDoc.numPages);
      const page = await pdfDoc.getPage(clampedPage);
      const viewport = page.getViewport({ scale });
      targetCanvas.width = Math.ceil(viewport.width);
      targetCanvas.height = Math.ceil(viewport.height);
      const ctx = targetCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      await page.render({ canvasContext: ctx, canvas: targetCanvas, viewport }).promise;
    },

    async cropNormalizedBox(
      pageNumber: number,
      box2d: [number, number, number, number],
      scale = 2.2
    ): Promise<{ blob: Blob; previewUrl: string }> {
      const sourceCanvas = await getRenderedCanvas(pageNumber, scale);
      const [ymin, xmin, ymax, xmax] = box2d;

      const padPx = 10;
      const sx = Math.max(0, Math.floor((xmin / 1000) * sourceCanvas.width) - padPx);
      const sy = Math.max(0, Math.floor((ymin / 1000) * sourceCanvas.height) - padPx);
      const ex = Math.min(sourceCanvas.width, Math.ceil((xmax / 1000) * sourceCanvas.width) + padPx);
      const ey = Math.min(sourceCanvas.height, Math.ceil((ymax / 1000) * sourceCanvas.height) + padPx);

      const sw = Math.max(24, ex - sx);
      const sh = Math.max(24, ey - sy);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cCtx = cropCanvas.getContext('2d')!;
      cCtx.fillStyle = '#ffffff';
      cCtx.fillRect(0, 0, sw, sh);
      cCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise<Blob>((resolve, reject) => {
        cropCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Không thể cắt ảnh từ trang PDF.'))),
          'image/png',
          0.92
        );
      });

      return {
        blob,
        previewUrl: URL.createObjectURL(blob),
      };
    },

    async toBase64() {
      return arrayBufferToBase64(bufferForBase64);
    },

    destroy() {
      offscreenCache.clear();
      void pdfDoc.cleanup();
      void loadingTask.destroy();
    },
  };
}
