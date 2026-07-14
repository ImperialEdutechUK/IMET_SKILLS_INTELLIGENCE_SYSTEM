// pdf-parse ships types for its package entry but not the internal lib path we
// import to avoid its debug harness. Declare the subpath here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: unknown): Promise<PDFParseResult>;
  export default pdfParse;
}
