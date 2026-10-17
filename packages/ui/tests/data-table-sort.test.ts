// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
import { nextSort, sortFromHeaders } from '../src/html/elements/data-table/sort-state.js';

describe('Activating a sortable header cycles its sort', () => {
  it('starts an unsorted column ascending', () => {
    expect(nextSort(null, 'name')).toEqual({ key: 'name', direction: 'ascending' });
  });

  it('turns ascending into descending', () => {
    expect(nextSort({ key: 'name', direction: 'ascending' }, 'name')).toEqual({
      key: 'name',
      direction: 'descending',
    });
  });

  it('turns descending back into unsorted', () => {
    expect(nextSort({ key: 'name', direction: 'descending' }, 'name')).toBeNull();
  });

  it('starts another column ascending, replacing the current sort', () => {
    expect(nextSort({ key: 'name', direction: 'descending' }, 'stock')).toEqual({
      key: 'stock',
      direction: 'ascending',
    });
  });
});

describe('The current sort is read from the markup', () => {
  it('takes the header whose aria-sort is a direction', () => {
    const headers = [
      { key: 'sku', ariaSort: null },
      { key: 'stock', ariaSort: 'descending' },
    ];
    expect(sortFromHeaders(headers)).toEqual({ key: 'stock', direction: 'descending' });
  });

  it('ignores "none", "other" and missing values', () => {
    const headers = [
      { key: 'sku', ariaSort: 'none' },
      { key: 'name', ariaSort: 'other' },
      { key: 'stock', ariaSort: null },
    ];
    expect(sortFromHeaders(headers)).toBeNull();
  });

  it('takes the first one when the markup marks several', () => {
    const headers = [
      { key: 'sku', ariaSort: 'ascending' },
      { key: 'name', ariaSort: 'descending' },
    ];
    expect(sortFromHeaders(headers)).toEqual({ key: 'sku', direction: 'ascending' });
  });
});
