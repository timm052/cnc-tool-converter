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
  sample: [
    '%',
    'O9999 (TOOL OFFSETS)',
    'G90',
    'G10 L10 P1 R200.0000 (T1 H GEO - 1/2 ENDMILL)',
    'G10 L11 P1 R0.0000',
    'G10 L12 P1 R12.7000 (T1 D GEO)',
    'G10 L13 P1 R0.0000',
    'G10 L10 P2 R195.3750 (T2 H GEO - 1/4 DRILL)',
    'G10 L12 P2 R6.3500',
    'G10 L10 P5 R182.0000 (T5 H GEO - 3/8 BALL)',
    'G10 L12 P5 R9.5250',
    'M30',
    '%',
  ].join('\n'),
  parse: (content, filename) => parseFanuc(content, filename),
  write: (tools, options)    => writeFanuc(tools, options),
};
