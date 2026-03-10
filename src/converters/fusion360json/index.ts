import type { Converter } from '../../types/converter';
import { parseFusion360JSON } from './parser';
import { writeFusion360JSON } from './writer';

export const fusion360jsonConverter: Converter = {
  format: {
    id:             'fusion360json',
    name:           'Fusion 360 Cloud Library (JSON)',
    description:    'Fusion 360 cloud tool library JSON export (.json)',
    fileExtensions: ['.json'],
    mimeTypes:      ['application/json'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },
  parse: (content, filename) => parseFusion360JSON(content, filename),
  write: (tools, options)    => writeFusion360JSON(tools, options),
};
