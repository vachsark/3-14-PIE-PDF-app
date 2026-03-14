import { PDFDocument, degrees } from 'pdf-lib';
import { PageState } from '../types';

export const getPdfInfo = async (file: File, fileIndex: number): Promise<PageState[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  return pages.map((page, i) => ({
    fileIndex,
    pageIndex: i,
    originalRotation: page.getRotation().angle,
    addedRotation: 0,
    crop: null,
    selected: true,
  }));
};

export const savePdf = async (files: File[], pages: PageState[]): Promise<Uint8Array> => {
  const newPdfDoc = await PDFDocument.create();

  const selectedPages = pages.filter(p => p.selected);

  if (selectedPages.length === 0) {
    throw new Error("No pages selected to export");
  }

  // Cache loaded source documents to avoid re-parsing for every page
  const docCache: Record<number, PDFDocument> = {};

  for (const state of selectedPages) {
    let srcDoc = docCache[state.fileIndex];
    if (!srcDoc) {
        const arrayBuffer = await files[state.fileIndex].arrayBuffer();
        srcDoc = await PDFDocument.load(arrayBuffer);
        docCache[state.fileIndex] = srcDoc;
    }

    const [page] = await newPdfDoc.copyPages(srcDoc, [state.pageIndex]);
    
    // Normalize total rotation to 0, 90, 180, 270
    let totalRotation = (state.originalRotation + state.addedRotation) % 360;
    if (totalRotation < 0) totalRotation += 360;

    // Apply Rotation
    page.setRotation(degrees(totalRotation));

    // Apply Crop
    if (state.crop) {
        const { x, y, width, height } = state.crop;
        const mediaBox = page.getMediaBox();
        
        let finalX, finalY, finalW, finalH;

        // Coordinate Transformation (Visual % -> PDF Point mapping)
        switch (totalRotation) {
            case 90:
                finalX = y;
                finalY = x;
                finalW = height;
                finalH = width;
                break;
            case 180:
                finalX = 1 - x - width;
                finalY = y;
                finalW = width;
                finalH = height;
                break;
            case 270:
                finalX = 1 - y - height;
                finalY = 1 - x - width;
                finalW = height;
                finalH = width;
                break;
            default: // 0
                finalX = x;
                finalY = 1 - y - height;
                finalW = width;
                finalH = height;
                break;
        }

        const cropX = mediaBox.x + finalX * mediaBox.width;
        const cropY = mediaBox.y + finalY * mediaBox.height;
        const cropW = finalW * mediaBox.width;
        const cropH = finalH * mediaBox.height;

        page.setCropBox(cropX, cropY, cropW, cropH);
    }

    newPdfDoc.addPage(page);
  }

  return await newPdfDoc.save();
};

export const downloadBlob = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};