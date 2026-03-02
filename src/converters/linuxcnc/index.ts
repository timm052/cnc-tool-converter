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
  parse: (content, filename) => parseLinuxCNC(content, filename),
  write: (tools, options)    => writeLinuxCNC(tools, options),
};
