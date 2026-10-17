/**
 * Sort state of a data table: one column at a time, in the `aria-sort`
 * vocabulary, so the state and the attribute that carries it are the same
 * values. Pure functions — the element reads headers and fires events with them.
 */

export type SortDirection = 'ascending' | 'descending';

export interface SortEntry {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface SortHeader {
  readonly key: string;
  readonly ariaSort: string | null;
}

/** The sort after activating `key`: unsorted → ascending → descending → unsorted. */
export function nextSort(current: SortEntry | null, key: string): SortEntry | null {
  if (current?.key !== key) return { key, direction: 'ascending' };
  return current.direction === 'ascending' ? { key, direction: 'descending' } : null;
}

/** The sort the markup states: the first header whose `aria-sort` is a direction. */
export function sortFromHeaders(headers: readonly SortHeader[]): SortEntry | null {
  for (const { key, ariaSort } of headers) {
    if (ariaSort === 'ascending' || ariaSort === 'descending') return { key, direction: ariaSort };
  }
  return null;
}
