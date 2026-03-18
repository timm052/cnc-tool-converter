/**
 * CSV Converter — wraps the existing csvLibrary helpers as a proper Converter
 * registered in the ConverterRegistry.
 *
 * The CSV format is CNC Tool Converter's own interchange format. It carries
 * library-specific fields (tags, starred, machineGroups, toolMaterials, etc.)
 * in addition to the base Tool geometry, which is why it works best when
 * the tools came from the library (LibraryTool). When converting tools that
 * are not from the library, those extra columns are written as empty.
 */

import type { Converter } from '../../types/converter';
import type { LibraryTool } from '../../types/libraryTool';
import { toolsToCsv, csvToTools } from '../../lib/csvLibrary';

export const csvConverter: Converter = {
  format: {
    id:             'csv',
    name:           'CSV (spreadsheet)',
    description:    'Flat CSV with tool geometry, cutting parameters, tags and machine groups',
    fileExtensions: ['.csv'],
    mimeTypes:      ['text/csv', 'text/plain'],
    canImport:      true,
    canExport:      true,
    readAs:         'text',
  },

  async parse(content, filename) {
    const text = typeof content === 'string'
      ? content
      : new TextDecoder('utf-8').decode(content);

    const { tools, errors } = csvToTools(text);

    if (tools.length === 0 && errors.length === 0) {
      return {
        tools: [],
        warnings: [`No tool rows found in ${filename ?? 'file'}.`],
        errors: [],
      };
    }

    return { tools, warnings: [], errors };
  },

  async write(tools, options) {
    // At runtime these will be LibraryTool objects when coming from the library;
    // cast with safe fallbacks for base Tool objects.
    const libTools = tools.map((t): LibraryTool => ({
      tags:      [],
      starred:   false,
      addedAt:   Date.now(),
      updatedAt: Date.now(),
      machineGroups: [],
      ...t,
    } as LibraryTool));

    const csv      = toolsToCsv(libTools);
    const baseName = (options?.filename as string | undefined)?.replace(/\.[^.]+$/, '')
      ?? 'library-export';

    return {
      content:  csv,
      filename: `${baseName}.csv`,
      mimeType: 'text/csv',
      warnings: [],
    };
  },
};
