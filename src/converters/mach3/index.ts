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
  sample: [
    '1,"1/2 End Mill",0.5000,0.0000,4.2500,0.0000',
    '2,"1/4 Drill",0.2500,0.0000,3.8750,0.0010',
    '5,"3/8 Ball Mill",0.3750,0.0000,4.1250,0.0000',
  ].join('\n'),
  parse: (content, filename) => parseMach3(content, filename),
  write: (tools, options)    => writeMach3(tools, options),
};
