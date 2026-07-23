/**
 * pdfjs (via pdf-parse) uses bare `DOMMatrix` / `Path2D` / `ImageData`.
 * On some serverless hosts those globals are missing and @napi-rs/canvas
 * may fail to load — polyfill before importing pdf-parse.
 */
export async function ensurePdfDomPolyfills() {
  const g = globalThis as Record<string, unknown>;

  if (g.DOMMatrix && g.Path2D && g.ImageData) return;

  try {
    const canvas = await import("@napi-rs/canvas");
    if (!g.DOMMatrix && canvas.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
    if (!g.Path2D && canvas.Path2D) g.Path2D = canvas.Path2D;
    if (!g.ImageData && canvas.ImageData) g.ImageData = canvas.ImageData;
  } catch {
    // Native canvas unavailable — fall through to JS polyfill.
  }

  if (!g.DOMMatrix) {
    g.DOMMatrix = MinimalDOMMatrix;
  }
}

type MatrixLike = {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;
};

/** Enough of DOMMatrix for pdfjs text extraction transforms. */
class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: string | number[] | MatrixLike) {
    if (!init) return;
    if (typeof init === "string") {
      const m = init
        .replace(/^matrix\(/, "")
        .replace(/\)$/, "")
        .split(",")
        .map((n) => Number(n.trim()));
      if (m.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = m as [
          number,
          number,
          number,
          number,
          number,
          number,
        ];
      }
      return;
    }
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      return;
    }
    const m = init as MatrixLike;
    this.a = Number(m.a ?? 1);
    this.b = Number(m.b ?? 0);
    this.c = Number(m.c ?? 0);
    this.d = Number(m.d ?? 1);
    this.e = Number(m.e ?? 0);
    this.f = Number(m.f ?? 0);
  }

  multiplySelf(other: MinimalDOMMatrix) {
    const a = this.a * other.a + this.c * other.b;
    const b = this.b * other.a + this.d * other.b;
    const c = this.a * other.c + this.c * other.d;
    const d = this.b * other.c + this.d * other.d;
    const e = this.a * other.e + this.c * other.f + this.e;
    const f = this.b * other.e + this.d * other.f + this.f;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  preMultiplySelf(other: MinimalDOMMatrix) {
    const copy = new MinimalDOMMatrix(this);
    this.a = other.a;
    this.b = other.b;
    this.c = other.c;
    this.d = other.d;
    this.e = other.e;
    this.f = other.f;
    return this.multiplySelf(copy);
  }

  invertSelf() {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (!det) {
      this.a = NaN;
      this.b = NaN;
      this.c = NaN;
      this.d = NaN;
      this.e = NaN;
      this.f = NaN;
      return this;
    }
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }

  translateSelf(tx: number, ty: number) {
    return this.multiplySelf(new MinimalDOMMatrix([1, 0, 0, 1, tx, ty]));
  }

  scaleSelf(sx: number, sy = sx) {
    return this.multiplySelf(new MinimalDOMMatrix([sx, 0, 0, sy, 0, 0]));
  }

  toString() {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}
