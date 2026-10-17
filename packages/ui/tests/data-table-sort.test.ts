// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
import { nextSorting, sortingFromHeaders } from '../src/html/elements/data-table/sort-state.js';

describe('Activating a sortable header cycles its sort', () => {
  it('starts an unsorted column ascending', () => {
    expect(nextSorting([], 'name')).toEqual([{ id: 'name', desc: false }]);
  });

  it('turns ascending into descending', () => {
    expect(nextSorting([{ id: 'name', desc: false }], 'name')).toEqual([
      { id: 'name', desc: true },
    ]);
  });

  it('turns descending back into unsorted', () => {
    expect(nextSorting([{ id: 'name', desc: true }], 'name')).toEqual([]);
  });

  it('starts another column ascending, replacing the current sort', () => {
    expect(nextSorting([{ id: 'name', desc: true }], 'stock')).toEqual([
      { id: 'stock', desc: false },
    ]);
  });
});

describe('The current sort is read from the markup', () => {
  it('takes the header whose aria-sort is a direction', () => {
    const headers = [
      { key: 'sku', ariaSort: null },
      { key: 'stock', ariaSort: 'descending' },
    ];
    expect(sortingFromHeaders(headers)).toEqual([{ id: 'stock', desc: true }]);
  });

  it('ignores "none", "other" and missing values', () => {
    const headers = [
      { key: 'sku', ariaSort: 'none' },
      { key: 'name', ariaSort: 'other' },
      { key: 'stock', ariaSort: null },
    ];
    expect(sortingFromHeaders(headers)).toEqual([]);
  });

  it('takes the first one when the markup marks several', () => {
    const headers = [
      { key: 'sku', ariaSort: 'ascending' },
      { key: 'name', ariaSort: 'descending' },
    ];
    expect(sortingFromHeaders(headers)).toEqual([{ id: 'sku', desc: false }]);
  });
});
