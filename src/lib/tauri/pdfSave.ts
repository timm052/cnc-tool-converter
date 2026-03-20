/**
 * savePdfDoc
 *
 * Replaces all `doc.save(filename)` calls throughout the app.
 *
 * - Browser / PWA: delegates to jsPDF's own `.save()` (blob download, no change)
 * - Tauri desktop:  calls `doc.output('arraybuffer')`, shows a native Save-As
 *   dialog via tauri-plugin-dialog, then writes the bytes via tauri-plugin-fs.
 *
 * Usage:
 *   import { savePdfDoc } from '../tauri/pdfSave';
 *   // replace:  doc.save('my-file.pdf');
 *   // with:     await savePdfDoc(doc, 'my-file.pdf');
 */

import type jsPDF from 'jspdf';
import { isTauri, saveBinaryFile } from './fs';

export async function savePdfDoc(doc: jsPDF, filename: string): Promise<void> {
  if (isTauri()) {
    const bytes = doc.output('arraybuffer');
    await saveBinaryFile(new Uint8Array(bytes), filename, 'application/pdf');
    return;
  }
  // Browser / PWA — jsPDF handles the download natively
  doc.save(filename);
}
