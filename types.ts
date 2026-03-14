export interface PageState {
  fileIndex: number; // Index of the file in the files array
  pageIndex: number; // 0-based index
  originalRotation: number; // The rotation of the page as extracted from PDF
  addedRotation: number; // Rotation added by user (0, 90, 180, 270)
  crop: CropBox | null; // Normalized crop box (0-1)
  selected: boolean;
}

export interface CropBox {
  x: number; // 0-1 percentage of width
  y: number; // 0-1 percentage of height
  width: number; // 0-1 percentage
  height: number; // 0-1 percentage
}

export interface PdfDocumentInfo {
  name: string;
  pageCount: number;
  file: File;
}

export enum ToolMode {
  SELECT = 'SELECT',
  CROP = 'CROP',
}