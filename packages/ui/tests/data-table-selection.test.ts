// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
import {
  SelectionState,
  selectedKeys,
  toRowSelection,
} from '../src/html/elements/data-table/selection-state.js';

const VISIBLE = ['a', 'b', 'c', 'd', 'e'];

describe('With checkboxes, several rows can be selected', () => {
  it('toggles a row in and out', () => {
    const s = new SelectionState('multiple');
    expect(s.toggle('b')).toBe(true);
    expect(s.keys).toEqual(['b']);
    expect(s.toggle('b')).toBe(true);
    expect(s.keys).toEqual([]);
  });

  it('keeps keys in the order they were selected', () => {
    const s = new SelectionState('multiple');
    s.toggle('c');
    s.toggle('a');
    expect(s.keys).toEqual(['c', 'a']);
  });

  it('reports no change when a row is set to the state it already has', () => {
    const s = new SelectionState('multiple');
    s.toggle('a');
    expect(s.select('a', true)).toBe(false);
    expect(s.select('b', false)).toBe(false);
  });

  it('clears, reporting a change only when something was selected', () => {
    const s = new SelectionState('multiple');
    expect(s.clear()).toBe(false);
    s.toggle('a');
    expect(s.clear()).toBe(true);
    expect(s.keys).toEqual([]);
  });

  it('takes a whole selection when set from outside, without an anchor', () => {
    const s = new SelectionState('multiple');
    s.set(['b', 'd']);
    expect(s.keys).toEqual(['b', 'd']);
    s.range(VISIBLE, 'c');
    expect(s.keys).toEqual(['b', 'd', 'c']);
  });
});

describe('With radios, one row at most is selected', () => {
  it('replaces the selected row', () => {
    const s = new SelectionState('single');
    s.toggle('a');
    s.toggle('c');
    expect(s.keys).toEqual(['c']);
  });

  it('treats re-selecting the selected row as no change, like a native radio', () => {
    const s = new SelectionState('single');
    s.toggle('a');
    expect(s.toggle('a')).toBe(false);
    expect(s.keys).toEqual(['a']);
  });

  it('turns a range into selecting its target', () => {
    const s = new SelectionState('single');
    s.toggle('a');
    s.range(VISIBLE, 'd');
    expect(s.keys).toEqual(['d']);
  });

  it('keeps only the first key when set from outside', () => {
    const s = new SelectionState('single');
    s.set(['b', 'c']);
    expect(s.keys).toEqual(['b']);
  });
});

describe('Shift selects a range from the last row toggled', () => {
  it('selects every visible row between the anchor and the target', () => {
    const s = new SelectionState('multiple');
    s.toggle('b');
    expect(s.range(VISIBLE, 'd')).toBe(true);
    expect(new Set(s.keys)).toEqual(new Set(['b', 'c', 'd']));
  });

  it('works upwards too', () => {
    const s = new SelectionState('multiple');
    s.toggle('d');
    s.range(VISIBLE, 'b');
    expect(new Set(s.keys)).toEqual(new Set(['b', 'c', 'd']));
  });

  it('applies the anchor’s new state, so a range can deselect', () => {
    const s = new SelectionState('multiple');
    s.set(VISIBLE);
    s.toggle('b');
    s.range(VISIBLE, 'd');
    expect(s.keys).toEqual(['a', 'e']);
  });

  it('falls back to a plain toggle when the anchor has left the visible rows', () => {
    const s = new SelectionState('multiple');
    s.toggle('z');
    s.range(VISIBLE, 'c');
    expect(new Set(s.keys)).toEqual(new Set(['c', 'z']));
  });

  it('falls back to a plain toggle when there is no anchor yet', () => {
    const s = new SelectionState('multiple');
    s.range(VISIBLE, 'c');
    expect(s.keys).toEqual(['c']);
  });

  it('falls back to a plain toggle when the target is not visible', () => {
    const s = new SelectionState('multiple');
    s.toggle('a');
    s.range(VISIBLE, 'z');
    expect(new Set(s.keys)).toEqual(new Set(['a', 'z']));
  });

  it('moves the anchor to the end of the range', () => {
    const s = new SelectionState('multiple');
    s.toggle('a');
    s.range(VISIBLE, 'b');
    s.range(VISIBLE, 'd');
    expect(new Set(s.keys)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
});

describe('Rows that leave the page stay selected', () => {
  it('keeps keys that are not visible when the visible ones are toggled', () => {
    const s = new SelectionState('multiple');
    s.set(['x', 'y']);
    s.setVisible(VISIBLE, true);
    expect(s.keys).toEqual(['x', 'y', ...VISIBLE]);
    s.setVisible(VISIBLE, false);
    expect(s.keys).toEqual(['x', 'y']);
  });
});

describe('The header checkbox reflects the visible rows', () => {
  it('is none, some or all', () => {
    const s = new SelectionState('multiple');
    expect(s.headerState(VISIBLE)).toBe('none');
    s.toggle('a');
    expect(s.headerState(VISIBLE)).toBe('some');
    s.setVisible(VISIBLE, true);
    expect(s.headerState(VISIBLE)).toBe('all');
  });

  it('ignores selected keys from other pages', () => {
    const s = new SelectionState('multiple');
    s.set(['x']);
    expect(s.headerState(VISIBLE)).toBe('none');
  });

  it('is none for an empty page', () => {
    const s = new SelectionState('multiple');
    s.set(['x']);
    expect(s.headerState([])).toBe('none');
  });
});

describe('"All matching" stands for rows beyond the page', () => {
  it('is cleared by any change a user makes', () => {
    const s = new SelectionState('multiple');
    s.setVisible(VISIBLE, true);
    s.allMatching = true;
    expect(s.toggle('a')).toBe(true);
    expect(s.allMatching).toBe(false);
  });

  it('counts as a change when clearing an otherwise empty selection', () => {
    const s = new SelectionState('multiple');
    s.allMatching = true;
    expect(s.clear()).toBe(true);
    expect(s.allMatching).toBe(false);
  });

  it('never applies to radios', () => {
    const s = new SelectionState('single');
    s.allMatching = true;
    expect(s.allMatching).toBe(false);
  });
});

describe('The selection is reported as TanStack Table’s RowSelectionState', () => {
  it('maps each selected key to true', () => {
    expect(toRowSelection(['sku-1', 'sku-3'])).toEqual({ 'sku-1': true, 'sku-3': true });
  });

  it('reads back the keys set to true, ignoring the false ones TanStack may leave', () => {
    expect(selectedKeys({ 'sku-1': true, 'sku-2': false, 'sku-3': true })).toEqual([
      'sku-1',
      'sku-3',
    ]);
  });
});

describe('Shift with an arrow extends the selection from the focused row', () => {
  it('selects the row it starts from and the row it reaches', () => {
    const s = new SelectionState('multiple');
    expect(s.extend(VISIBLE, 'a', 'b')).toBe(true);
    expect(new Set(s.keys)).toEqual(new Set(['a', 'b']));
  });

  it('keeps extending as the focus moves on', () => {
    const s = new SelectionState('multiple');
    s.extend(VISIBLE, 'a', 'b');
    s.extend(VISIBLE, 'b', 'c');
    s.extend(VISIBLE, 'c', 'd');
    expect(new Set(s.keys)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('starts from the focused row when the anchor has left the visible rows', () => {
    const s = new SelectionState('multiple');
    s.toggle('z');
    s.extend(VISIBLE, 'c', 'd');
    expect(new Set(s.keys)).toEqual(new Set(['z', 'c', 'd']));
  });

  it('selects the reached row alone with radios', () => {
    const s = new SelectionState('single');
    s.extend(VISIBLE, 'a', 'b');
    expect(s.keys).toEqual(['b']);
  });
});
