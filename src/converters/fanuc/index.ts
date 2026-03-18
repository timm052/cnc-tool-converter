import type { Converter } from '../../types/converter';
import { parseFanuc } from './parser';
import { writeFanuc } from './writer';

export const fanucConverter: Converter = {
  format: {
    id:             'fanuc',
    name:           'Fanuc',
    description:    'Fanuc CNC tool offset table — G10 punch format (.nc)',
    fileExtensions: ['.nc', '.txt', '.cnc'],
    mimeTypes:      ['text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },
  parse: (content, filename) => parseFanuc(content, filename),
  write: (tools, options)    => writeFanuc(tools, options),
};
