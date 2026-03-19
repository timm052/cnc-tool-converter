import type { Converter } from '../../types/converter';
import { parseLinuxCNC } from './parser';
import { writeLinuxCNC } from './writer';

export const linuxcncConverter: Converter = {
  format: {
    id:             'linuxcnc',
    name:           'LinuxCNC',
    description:    'LinuxCNC / EMC2 tool table (.tbl)',
    fileExtensions: ['.tbl', '.tool'],
    mimeTypes:      ['text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },
  sample: [
    ';',
    'T1 P1 X0 Y0 Z0 A0 B0 C0 U0 V0 W0 D10.000 I0 J0 Q0 ; 10mm Flat End Mill',
    'T2 P2 D6.350 ; 1/4in Ball End Mill',
    'T3 P3 D8.000 I25.0 J50.0 Q2 ; Lathe turning tool',
  ].join('\n'),
  parse: (content, filename) => parseLinuxCNC(content, filename),
  write: (tools, options)    => writeLinuxCNC(tools, options),
};
