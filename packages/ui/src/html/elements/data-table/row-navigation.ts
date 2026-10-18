/**
 * Row navigation of a data table with `navigable`: which row a key moves the
 * focus to. Rows only, never cells — the table keeps table semantics. Pure, so
 * the element reads the keys and the rows and applies the result.
 */

/** Rows a Page Up or Page Down moves by. */
export const PAGE_ROWS = 10;

/**
 * The index of the row `key` moves to from row `current` among `count` rows,
 * clamped to the table (no wrapping), or `null` when the key is not a
 * navigation key or there is no row.
 */
export function rowTarget(
  key: string,
  current: number,
  count: number,
  pageSize = PAGE_ROWS,
): number | null {
  if (count === 0) return null;
  const last = count - 1;
  const clamp = (index: number) => Math.min(Math.max(index, 0), last);
  switch (key) {
    case 'ArrowDown':
      return clamp(current + 1);
    case 'ArrowUp':
      return clamp(current - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return clamp(current + pageSize);
    case 'PageUp':
      return clamp(current - pageSize);
    default:
      return null;
  }
}
