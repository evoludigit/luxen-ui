/**
 * Sort state of a data table, in TanStack Table's `SortingState` shape so a
 * page can hand it straight to TanStack or map it to its query. One column at
 * a time: the array holds at most one entry. Pure functions — the element reads
 * the headers' `aria-sort` and fires events with these values.
 */

/** One sorted column, as TanStack Table's `ColumnSort`. */
export interface ColumnSort {
  readonly id: string;
  readonly desc: boolean;
}

/** The sorted columns, as TanStack Table's `SortingState`. */
export type SortingState = readonly ColumnSort[];

export interface SortHeader {
  readonly key: string;
  readonly ariaSort: string | null;
}

/** The sort after activating `id`: unsorted → ascending → descending → unsorted. */
export function nextSorting(current: SortingState, id: string): SortingState {
  const [sorted] = current;
  if (sorted?.id !== id) return [{ id, desc: false }];
  return sorted.desc ? [] : [{ id, desc: true }];
}

/** The sort the markup states: the first header whose `aria-sort` is a direction. */
export function sortingFromHeaders(headers: readonly SortHeader[]): SortingState {
  for (const { key, ariaSort } of headers) {
    if (ariaSort === 'ascending' || ariaSort === 'descending') {
      return [{ id: key, desc: ariaSort === 'descending' }];
    }
  }
  return [];
}
