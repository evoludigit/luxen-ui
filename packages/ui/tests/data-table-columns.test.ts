// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
import {
  columnOrder,
  columnVisibility,
  decode,
  encode,
  fromHeaders,
  hiddenIndices,
  merge,
  move,
  setVisible,
} from '../src/html/elements/data-table/column-state.js';

const DECLARED = fromHeaders([
  { key: 'sku', label: 'SKU', fixed: true },
  { key: 'name', label: 'Name' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'supplier', label: 'Supplier', hidden: true },
  { key: 'stock', label: 'In stock' },
]);

const keys = (columns: readonly { key: string }[]) => columns.map((c) => c.key);
const hidden = (columns: readonly { key: string; visible: boolean }[]) =>
  columns.filter((c) => !c.visible).map((c) => c.key);

describe('Columns start as the header declares them', () => {
  it('keeps the header order, labels and flags', () => {
    expect(DECLARED).toEqual([
      { key: 'sku', label: 'SKU', fixed: true, visible: true },
      { key: 'name', label: 'Name', fixed: false, visible: true },
      { key: 'warehouse', label: 'Warehouse', fixed: false, visible: true },
      { key: 'supplier', label: 'Supplier', fixed: false, visible: false },
      { key: 'stock', label: 'In stock', fixed: false, visible: true },
    ]);
  });

  it('never hides a fixed column, even when its header asks to', () => {
    const columns = fromHeaders([{ key: 'sku', label: 'SKU', fixed: true, hidden: true }]);
    expect(columns[0].visible).toBe(true);
  });
});

describe('Moving a column', () => {
  it('reorders among the movable columns, fixed ones keeping their place', () => {
    expect(keys(move(DECLARED, 'stock', 0))).toEqual([
      'sku',
      'stock',
      'name',
      'warehouse',
      'supplier',
    ]);
  });

  it('clamps a position past the end', () => {
    expect(keys(move(DECLARED, 'name', 99))).toEqual([
      'sku',
      'warehouse',
      'supplier',
      'stock',
      'name',
    ]);
  });

  it('refuses to move a fixed column or an unknown key', () => {
    expect(move(DECLARED, 'sku', 2)).toBe(DECLARED);
    expect(move(DECLARED, 'nope', 2)).toBe(DECLARED);
  });

  it('returns the same columns when nothing moves', () => {
    expect(move(DECLARED, 'name', 0)).toBe(DECLARED);
  });
});

describe('Showing and hiding a column', () => {
  it('hides and shows a movable column', () => {
    const next = setVisible(DECLARED, 'name', false);
    expect(hidden(next)).toEqual(['name', 'supplier']);
    expect(hidden(setVisible(next, 'name', true))).toEqual(['supplier']);
  });

  it('refuses a fixed column and returns the same columns when nothing changes', () => {
    expect(setVisible(DECLARED, 'sku', false)).toBe(DECLARED);
    expect(setVisible(DECLARED, 'name', true)).toBe(DECLARED);
  });
});

describe('Saved preferences meet the current header', () => {
  it('apply the saved order and visibility', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['sku', 'stock', 'name', 'warehouse', 'supplier'],
      columnVisibility: { warehouse: false, supplier: true },
    });
    expect(keys(merged)).toEqual(['sku', 'stock', 'name', 'warehouse', 'supplier']);
    expect(hidden(merged)).toEqual(['warehouse']);
  });

  it('drop columns the header no longer has', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['gone', 'stock', 'name', 'warehouse', 'supplier'],
      columnVisibility: { gone: false, supplier: true },
    });
    expect(keys(merged)).toEqual(['sku', 'stock', 'name', 'warehouse', 'supplier']);
    expect(hidden(merged)).toEqual([]);
  });

  it('place a newly declared column after its declared predecessor', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['stock', 'name', 'supplier'],
      columnVisibility: { supplier: true },
    });
    expect(keys(merged)).toEqual(['sku', 'stock', 'name', 'warehouse', 'supplier']);
  });

  it('put a new first movable column first', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['stock', 'warehouse', 'supplier'],
      columnVisibility: { supplier: true },
    });
    expect(keys(merged)).toEqual(['sku', 'name', 'stock', 'warehouse', 'supplier']);
  });

  it('cannot move or hide a fixed column', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['name', 'warehouse', 'sku', 'supplier', 'stock'],
      columnVisibility: { sku: false, supplier: true },
    });
    expect(keys(merged)).toEqual(['sku', 'name', 'warehouse', 'supplier', 'stock']);
    expect(hidden(merged)).toEqual([]);
  });

  it('give a column they do not know its declared visibility', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['stock', 'name', 'warehouse'],
      columnVisibility: {},
    });
    expect(hidden(merged)).toEqual(['supplier']);
  });

  it('apply the visibility of columns the order does not list', () => {
    const merged = merge(DECLARED, {
      columnOrder: [],
      columnVisibility: { supplier: true, name: false },
    });
    expect(keys(merged)).toEqual(['sku', 'name', 'warehouse', 'supplier', 'stock']);
    expect(hidden(merged)).toEqual(['name']);
  });

  it('give a column the visibility map leaves out its declared visibility', () => {
    const merged = merge(DECLARED, {
      columnOrder: ['sku', 'name', 'warehouse', 'supplier', 'stock'],
      columnVisibility: { name: false },
    });
    expect(hidden(merged)).toEqual(['name', 'supplier']);
  });

  it('leave the declared state alone when there is nothing saved', () => {
    expect(merge(DECLARED, null)).toBe(DECLARED);
  });
});

describe('Columns are reported in TanStack Table’s state shapes', () => {
  it('list every keyed column in order, fixed ones included', () => {
    expect(columnOrder(move(DECLARED, 'stock', 0))).toEqual([
      'sku',
      'stock',
      'name',
      'warehouse',
      'supplier',
    ]);
  });

  it('map every keyed column to its visibility', () => {
    expect(columnVisibility(setVisible(DECLARED, 'name', false))).toEqual({
      sku: true,
      name: false,
      warehouse: true,
      supplier: false,
      stock: true,
    });
  });
});

describe('Preferences are stored in a versioned format', () => {
  it('round-trips', () => {
    const columns = setVisible(move(DECLARED, 'stock', 0), 'name', false);
    const stored = encode(columns);
    expect(stored).toEqual({
      v: 1,
      columnOrder: ['sku', 'stock', 'name', 'warehouse', 'supplier'],
      columnVisibility: { sku: true, stock: true, name: false, warehouse: true, supplier: false },
    });
    expect(decode(JSON.stringify(stored))).toEqual(stored);
  });

  it('rejects anything else', () => {
    for (const raw of [
      null,
      '',
      'not json',
      'null',
      '[]',
      '{"v":2,"columnOrder":[],"columnVisibility":{}}',
      '{"v":1,"columnOrder":"a","columnVisibility":{}}',
      '{"v":1,"columnOrder":[1],"columnVisibility":{}}',
      '{"v":1,"columnOrder":[],"columnVisibility":{"a":"no"}}',
      '{"v":1,"columnOrder":[],"columnVisibility":[]}',
      '{"v":1,"columnOrder":[]}',
      '{"v":1,"order":[],"hidden":[]}',
    ]) {
      expect(decode(raw), String(raw)).toBeNull();
    }
  });
});

describe('Hidden columns become :nth-child indices', () => {
  it('counts every header cell, keyed or not, from 1', () => {
    expect(hiddenIndices([null, 'sku', 'name', 'stock'], new Set(['name', 'stock']))).toEqual([
      3, 4,
    ]);
  });

  it('is empty when nothing is hidden', () => {
    expect(hiddenIndices(['sku', 'name'], new Set())).toEqual([]);
  });
});
