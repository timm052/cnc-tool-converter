import type { Converter } from '../../types/converter';
import { parseHaas } from './parser';
import { writeHaas } from './writer';

export const haasConverter: Converter = {
  format: {
    id:             'haas',
    name:           'HAAS',
    description:    'HAAS CNC tool offset table — Format A (.ofs)',
    fileExtensions: ['.ofs', '.ngc', '.nc'],
    mimeTypes:      ['text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },
  parse: (content, filename) => parseHaas(content, filename),
  write: (tools, options)    => writeHaas(tools, options),
};
