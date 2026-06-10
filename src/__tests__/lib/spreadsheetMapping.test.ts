import { describe, it, expect } from 'vitest';
import { guessMapping, buildToolsFromMapping, MAPPABLE_FIELDS } from '../../lib/spreadsheetMapping';

describe('guessMapping', () => {
  it('matches common header aliases to field keys', () => {
    const mapping = guessMapping(['T#', 'Description', 'Dia', 'Flutes', 'RPM', 'Qty']);
    expect(mapping['T#']).toBe('toolNumber');
    expect(mapping['Description']).toBe('description');
    expect(mapping['Dia']).toBe('diameter');
    expect(mapping['Flutes']).toBe('numberOfFlutes');
    expect(mapping['RPM']).toBe('spindleRpm');
    expect(mapping['Qty']).toBe('quantity');
  });

  it('matches exact field labels case-insensitively', () => {
    const mapping = guessMapping(['Diameter', 'Manufacturer']);
    expect(mapping['Diameter']).toBe('diameter');
    expect(mapping['Manufacturer']).toBe('manufacturer');
  });

  it('leaves unrecognized headers unmapped', () => {
    const mapping = guessMapping(['Some Random Column']);
    expect(mapping['Some Random Column']).toBeUndefined();
  });

  it('only contains keys that exist in MAPPABLE_FIELDS', () => {
    const mapping = guessMapping(['T#', 'Dia', 'Qty', 'Unknown']);
    const validKeys = new Set(MAPPABLE_FIELDS.map((f) => f.key));
    for (const fieldKey of Object.values(mapping)) {
      expect(validKeys.has(fieldKey)).toBe(true);
    }
  });
});

describe('buildToolsFromMapping', () => {
  const defaults = { unit: 'mm' as const, type: 'flat end mill' as const };

  it('builds tools using mapped columns', () => {
    const rows = [
      { 'T#': '1', Name: '6mm Flat Endmill', Dia: '6', Flutes: '4' },
      { 'T#': '2', Name: '10mm Ball Endmill', Dia: '10', Flutes: '2' },
    ];
    const mapping = { toolNumber: 'T#', description: 'Name', diameter: 'Dia', numberOfFlutes: 'Flutes' };
    const tools = buildToolsFromMapping(rows, mapping, defaults);

    expect(tools).toHaveLength(2);
    expect(tools[0].toolNumber).toBe(1);
    expect(tools[0].description).toBe('6mm Flat Endmill');
    expect(tools[0].geometry.diameter).toBe(6);
    expect(tools[0].geometry.numberOfFlutes).toBe(4);
    expect(tools[1].toolNumber).toBe(2);
  });

  it('auto-numbers rows missing a tool number', () => {
    const rows = [
      { Name: 'First' },
      { Name: 'Second' },
    ];
    const tools = buildToolsFromMapping(rows, { description: 'Name' }, defaults);
    expect(tools[0].toolNumber).toBe(1);
    expect(tools[1].toolNumber).toBe(2);
  });

  it('splits tags and machine groups on commas/semicolons', () => {
    const rows = [{ Tags: 'roughing; aluminium', Machines: 'VF-2,VF-4' }];
    const mapping = { tags: 'Tags', machineGroup: 'Machines' };
    const tools = buildToolsFromMapping(rows, mapping, defaults);
    expect(tools[0].tags).toEqual(['roughing', 'aluminium']);
    expect(tools[0].machineGroups).toEqual(['VF-2', 'VF-4']);
  });

  it('omits cutting parameters object when no cutting fields are mapped', () => {
    const rows = [{ Dia: '8' }];
    const tools = buildToolsFromMapping(rows, { diameter: 'Dia' }, defaults);
    expect(tools[0].cutting).toBeUndefined();
  });

  it('builds cutting parameters when mapped', () => {
    const rows = [{ RPM: '12000', Feed: '500' }];
    const mapping = { spindleRpm: 'RPM', feedCutting: 'Feed' };
    const tools = buildToolsFromMapping(rows, mapping, defaults);
    expect(tools[0].cutting).toEqual({ spindleRpm: 12000, feedCutting: 500 });
  });

  it('falls back to default unit and type when not mapped', () => {
    const rows = [{ Dia: '5' }];
    const tools = buildToolsFromMapping(rows, { diameter: 'Dia' }, defaults);
    expect(tools[0].unit).toBe('mm');
    expect(tools[0].type).toBe('flat end mill');
  });

  it('reads unit from a mapped column when present', () => {
    const rows = [{ Dia: '0.25', Unit: 'inch' }];
    const mapping = { diameter: 'Dia', unit: 'Unit' };
    const tools = buildToolsFromMapping(rows, mapping, defaults);
    expect(tools[0].unit).toBe('inch');
  });
});
