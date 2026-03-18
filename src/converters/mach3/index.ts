import type { Converter } from '../../types/converter';
import { parseMach3 } from './parser';
import { writeMach3 } from './writer';

export const mach3Converter: Converter = {
  format: {
    id:             'mach3',
    name:           'Mach3 / Mach4',
    description:    'Mach3 / Mach4 tool table CSV (.csv)',
    fileExtensions: ['.csv'],
    mimeTypes:      ['text/csv', 'text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },
  parse: (content, filename) => parseMach3(content, filename),
  write: (tools, options)    => writeMach3(tools, options),
};
