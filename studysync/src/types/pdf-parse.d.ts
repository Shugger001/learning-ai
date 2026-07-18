declare module "pdf-parse" {
  interface LoadParameters {
    data?: Buffer | Uint8Array | ArrayBuffer;
    url?: string;
  }

  interface TextResult {
    text: string;
  }

  export class PDFParse {
    constructor(options: LoadParameters);
    getText(): Promise<TextResult>;
    destroy(): Promise<void>;
  }
}
