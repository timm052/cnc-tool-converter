import type { Tool } from './tool';

/**
 * Metadata describing a supported file format.
 * Used to populate the format selector UI and the converter registry.
 */
export interface FormatInfo {
  /** Unique format identifier (e.g. 'hsmlib', 'linuxcnc') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description shown in the UI */
  description: string;
  /** Accepted file extensions (e.g. ['.hsmlib', '.xml']) */
  fileExtensions: string[];
  mimeTypes: string[];
  canImport: boolean;
  canExport: boolean;
  /**
   * How to read the file before passing to parse().
   * 'arraybuffer' is needed for binary or non-UTF-8 encoded files.
   */
  readAs: 'text' | 'arraybuffer';
}

/** Result returned by a converter's parse() method */
export interface ParseResult {
  tools: Tool[];
  warnings: string[];
  errors: string[];
  /** Format-specific metadata (e.g. library GUID, version) */
  metadata?: Record<string, unknown>;
}

/** Result returned by a converter's write() method */
export interface WriteResult {
  /** The serialized file content */
  content: string;
  /** Suggested output filename */
  filename: string;
  mimeType: string;
  warnings: string[];
}

/** Options passed to write() */
export interface WriteOptions {
  filename?: string;
  [key: string]: unknown;
}

/**
 * Interface that every format converter must implement.
 * Add new formats by creating a class/object that satisfies this interface
 * and registering it with the ConverterRegistry.
 */
export interface Converter {
  format: FormatInfo;
  /**
   * Optional inline sample content for dev tooling (Format Mapping page).
   * Set this on text-based converters so the "Load & parse sample" button works
   * without needing a real file. Binary/XML formats leave this undefined.
   * New converters are automatically picked up by the dev page when this is set.
   */
  sample?: string;
  /**
   * Parse a file into the internal tool model.
   * @param content  Raw file content (string for text formats, ArrayBuffer for binary/UTF-16)
   * @param filename Optional source filename (used for error messages and output naming)
   */
  parse(content: string | ArrayBuffer, filename?: string): Promise<ParseResult>;
  /**
   * Serialize tools to the target format.
   */
  write(tools: Tool[], options?: WriteOptions): Promise<WriteResult>;
}

/**
 * Registry that manages all registered converters.
 * New converters are added by calling register() — no other code needs to change.
 */
export class ConverterRegistry {
  private readonly converters = new Map<string, Converter>();

  register(converter: Converter): void {
    this.converters.set(converter.format.id, converter);
  }

  getConverter(formatId: string): Converter | undefined {
    return this.converters.get(formatId);
  }

  getAllFormats(): FormatInfo[] {
    return Array.from(this.converters.values()).map((c) => c.format);
  }

  getImportableFormats(): FormatInfo[] {
    return this.getAllFormats().filter((f) => f.canImport);
  }

  getExportableFormats(): FormatInfo[] {
    return this.getAllFormats().filter((f) => f.canExport);
  }

  hasFormat(formatId: string): boolean {
    return this.converters.has(formatId);
  }
}
