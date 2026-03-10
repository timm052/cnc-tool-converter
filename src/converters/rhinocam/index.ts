import type { Converter } from '../../types/converter';
import { parseRhinoCamVKB } from './parser';

export const rhinocamConverter: Converter = {
  format: {
    id:             'rhinocam',
    name:           'RhinoCAM / VisualMill',
    description:    'RhinoCAM / VisualMill tool library (.vkb) — import only',
    fileExtensions: ['.vkb'],
    mimeTypes:      ['application/octet-stream'],
    canImport:      true,
    canExport:      false,
    readAs:         'arraybuffer',
  },
  parse: (content, filename) => parseRhinoCamVKB(content, filename),
  write: () => Promise.resolve({
    content:  '',
    filename: '',
    mimeType: 'application/octet-stream',
    warnings: ['RhinoCAM .vkb export is not supported — the format is proprietary binary.'],
  }),
};
