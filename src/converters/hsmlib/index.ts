import type { Converter } from '../../types/converter';
import { parseHSMLib } from './parser';
import { writeHSMLib } from './writer';

export const hsmlibConverter: Converter = {
  format: {
    id:             'hsmlib',
    name:           'Autodesk Inventor CAM / Fusion 360',
    description:    'HSMWorks / Autodesk Inventor CAM / Fusion 360 tool library (.hsmlib)',
    fileExtensions: ['.hsmlib'],
    mimeTypes:      ['application/xml', 'text/xml'],
    canImport:      true,
    canExport:      true,
    readAs:         'arraybuffer',
    notes: [
      'UTF-16 XML file — full geometry, cutting parameters, holder and coolant data round-trip.',
    ],
  },
  parse: (content, filename) => parseHSMLib(content, filename),
  write: (tools, options)    => writeHSMLib(tools, options),
};
