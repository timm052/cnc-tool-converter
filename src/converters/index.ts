/**
 * Converter Registry
 *
 * All registered converters are available here.
 * To add a new format:
 *   1. Create src/converters/<format>/index.ts implementing the Converter interface
 *   2. Import and register it below — nothing else needs to change.
 */

import { ConverterRegistry }      from '../types/converter';
import { hsmlibConverter }         from './hsmlib';
import { linuxcncConverter }       from './linuxcnc';
import { fusion360jsonConverter }  from './fusion360json';
import { rhinocamConverter }       from './rhinocam';

export const registry = new ConverterRegistry();

// ── Register converters ────────────────────────────────────────────────────
// Add new formats here:
registry.register(hsmlibConverter);
registry.register(linuxcncConverter);
registry.register(fusion360jsonConverter);
registry.register(rhinocamConverter);
// registry.register(haasConverter);
// registry.register(fanucConverter);
// registry.register(mach3Converter);

export { ConverterRegistry };
