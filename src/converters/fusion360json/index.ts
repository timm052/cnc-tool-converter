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
  sample: JSON.stringify({
    data: [
      {
        guid: 'f360-sample-1',
        type: 'flat end mill',
        description: '10mm Flat End Mill',
        vendor: 'Sandvik',
        'product-id': 'R216.3',
        unit: 'millimeters',
        BMC: 'carbide',
        geometry: { DC: 10, SFDM: 10, OAL: 72, LB: 32, LCF: 22, 'shoulder-length': 30, NOF: 4, RE: 0, TA: 0, CSP: true, HAND: true },
        'post-process': { number: 1, 'break-control': true, 'diameter-offset': 1, 'length-offset': 1, live: false, 'manual-tool-change': false, turret: 0 },
        'start-values': { presets: [{ preset: 'Default', parameters: { 'tool_spindleSpeed': '8000', 'tool_feedCutting': '800', 'tool_feedPlunge': '400' } }] },
      },
      {
        guid: 'f360-sample-2',
        type: 'ball end mill',
        description: '6mm Ball Nose',
        vendor: 'Kennametal',
        unit: 'millimeters',
        BMC: 'carbide',
        geometry: { DC: 6, SFDM: 6, OAL: 60, LCF: 22, NOF: 2, CSP: false },
        'post-process': { number: 2, 'break-control': false, 'diameter-offset': 2, 'length-offset': 2, live: false },
        'start-values': { presets: [{ preset: 'Default', parameters: { 'tool_spindleSpeed': '12000', 'tool_feedCutting': '600' } }] },
      },
    ],
  }, null, 2),
  parse: (content, filename) => parseFusion360JSON(content, filename),
  write: (tools, options)    => writeFusion360JSON(tools, options),
};
