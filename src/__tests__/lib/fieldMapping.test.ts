import { describe, it, expect } from 'vitest';
import {
  formatPairKey,
  applyFieldMapping,
} from '../../lib/fieldMapping';
import type { Tool } from '../../types/tool';
import type { FieldMapping } from '../../lib/fieldMapping';

const BASE_TOOL: Tool = {
  id: 'test-1',
  toolNumber: 1,
  type: 'flat end mill',
  description: 'Test Tool',
  comment: 'A comment',
  unit: 'mm',
  geometry: { diameter: 10, fluteLength: 22, numberOfFlutes: 4 },
  cutting: { spindleRpm: 8000, feedCutting: 1200, coolant: 'flood' },
};

describe('formatPairKey', () => {
  it('produces a stable key for a format pair', () => {
    expect(formatPairKey('hsmlib', 'linuxcnc')).toBe('hsmlib→linuxcnc');
  });

  it('is order-sensitive (source→target, not commutative)', () => {
    expect(formatPairKey('a', 'b')).not.toBe(formatPairKey('b', 'a'));
  });
});

describe('applyFieldMapping', () => {
  it('returns tools unchanged when there are no rules', () => {
    const mapping: FieldMapping = { formatPairKey: 'a→b', rules: [] };
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].description).toBe(BASE_TOOL.description);
  });

  it('copies a top-level field to another top-level field', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'description', targetField: 'comment' }],
    };
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].comment).toBe('Test Tool');
  });

  it('copies a nested field (geometry.diameter) to another nested path', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'geometry.diameter', targetField: 'geometry.shaftDiameter' }],
    };
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].geometry.shaftDiameter).toBe(10);
  });

  it('copies a nested source to a top-level target', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'cutting.spindleRpm', targetField: 'toolNumber' }],
    };
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].toolNumber).toBe(8000);
  });

  it('does not mutate the original tool', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'description', targetField: 'comment' }],
    };
    const original = BASE_TOOL.comment;
    applyFieldMapping([BASE_TOOL], mapping);
    expect(BASE_TOOL.comment).toBe(original);
  });

  it('applies multiple rules in order', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [
        { sourceField: 'description', targetField: 'comment' },
        { sourceField: 'geometry.fluteLength', targetField: 'geometry.bodyLength' },
      ],
    };
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].comment).toBe('Test Tool');
    expect(result[0].geometry.bodyLength).toBe(22);
  });

  it('skips a rule when source field is undefined', () => {
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'geometry.cornerRadius', targetField: 'geometry.bodyLength' }],
    };
    // cornerRadius is undefined on BASE_TOOL — target should stay undefined
    const result = applyFieldMapping([BASE_TOOL], mapping);
    expect(result[0].geometry.bodyLength).toBeUndefined();
  });

  it('processes multiple tools independently', () => {
    const toolA: Tool = { ...BASE_TOOL, id: 'a', description: 'Tool A' };
    const toolB: Tool = { ...BASE_TOOL, id: 'b', description: 'Tool B' };
    const mapping: FieldMapping = {
      formatPairKey: 'a→b',
      rules: [{ sourceField: 'description', targetField: 'comment' }],
    };
    const result = applyFieldMapping([toolA, toolB], mapping);
    expect(result[0].comment).toBe('Tool A');
    expect(result[1].comment).toBe('Tool B');
  });
});
