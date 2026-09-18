import { createWorker, type Worker } from "tesseract.js";
import type { OcrPageResult, OcrProvider } from "./types";

export interface TesseractOcrOptions {
  languages?: string | string[];
  langPath?: string;
  cachePath?: string;
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract.js";
  private worker: Worker | null = null;

  constructor(private readonly options: TesseractOcrOptions = {}) {}

  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    this.worker = await createWorker(
      this.options.languages ?? ["eng"],
      undefined,
      {
        ...(this.options.langPath ? { langPath: this.options.langPath } : {}),
        ...(this.options.cachePath ? { cachePath: this.options.cachePath } : {}),
      },
    );
    return this.worker;
  }

  async recognize(
    image: Uint8Array,
    _pageNumber: number,
  ): Promise<OcrPageResult> {
    const worker = await this.getWorker();
    const result = await worker.recognize(Buffer.from(image));
    const data = result.data as typeof result.data & { confidence?: number };
    return {
      text: data.text ?? "",
      confidence:
        typeof data.confidence === "number" ? data.confidence / 100 : null,
      language: Array.isArray(this.options.languages)
        ? this.options.languages.join("+")
        : this.options.languages ?? "eng",
      diagnostics: [],
    };
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
