/**
 * Column order and visibility of a data table, and their stored form. Pure
 * functions over immutable arrays: an operation that changes nothing returns
 * the array it was given, so callers can compare by identity.
 *
 * Fixed columns never move and never hide; the others are reordered among
 * themselves, the fixed ones keeping their declared places.
 *
 * Outside the element, the state travels in TanStack Table's shapes
 * (`ColumnOrderState`, `ColumnVisibilityState`), stored ones included, so a page
 * can hand it to TanStack or keep what it already stores in that form.
 */

export interface ColumnDeclaration {
  readonly key: string;
  readonly label: string;
  readonly fixed?: boolean;
  readonly hidden?: boolean;
}

export interface Column {
  readonly key: string;
  readonly label: string;
  readonly fixed: boolean;
  readonly visible: boolean;
}

/** Column keys in display order, as TanStack Table's `ColumnOrderState`. */
export type ColumnOrderState = readonly string[];

/** Visibility by column key, as TanStack Table's `ColumnVisibilityState`: a missing key is visible. */
export type ColumnVisibilityState = Readonly<Record<string, boolean>>;

export interface ColumnPreferences {
  readonly columnOrder: ColumnOrderState;
  readonly columnVisibility: ColumnVisibilityState;
}

/** Stored preferences: the two states under a format version. */
export interface StoredColumns extends ColumnPreferences {
  readonly v: 1;
}

export function fromHeaders(declarations: readonly ColumnDeclaration[]): Column[] {
  return declarations.map(({ key, label, fixed = false, hidden = false }) => ({
    key,
    label,
    fixed,
    visible: fixed || !hidden,
  }));
}

/** Puts the movable columns back around the fixed ones, at their declared indices. */
function interleave(template: readonly Column[], movable: readonly Column[]): Column[] {
  const rest = [...movable];
  return template.map((column) => (column.fixed ? column : rest.shift()!));
}

/** Moves `key` to `toIndex` among the movable columns. */
export function move(columns: readonly Column[], key: string, toIndex: number): readonly Column[] {
  const movable = columns.filter((c) => !c.fixed);
  const from = movable.findIndex((c) => c.key === key);
  const to = Math.min(Math.max(toIndex, 0), movable.length - 1);
  if (from === -1 || from === to) return columns;
  const [column] = movable.splice(from, 1);
  movable.splice(to, 0, column);
  return interleave(columns, movable);
}

export function setVisible(
  columns: readonly Column[],
  key: string,
  visible: boolean,
): readonly Column[] {
  const index = columns.findIndex((c) => c.key === key);
  const column = columns[index];
  if (!column || column.fixed || column.visible === visible) return columns;
  return columns.map((c, i) => (i === index ? { ...c, visible } : c));
}

/**
 * Applies preferences to the columns the header declares now. Keys the header
 * no longer has are dropped, and fixed columns keep their place and stay
 * visible. Order and visibility are independent, as in TanStack Table: the
 * order arranges the columns it lists, and a column it does not list sits after
 * its declared predecessor; the visibility map shows or hides the columns it
 * lists, and a column it does not list keeps its declared visibility.
 */
export function merge(
  declared: readonly Column[],
  preferences: ColumnPreferences | null,
): readonly Column[] {
  if (!preferences) return declared;
  const visibility: Readonly<Partial<Record<string, boolean>>> = preferences.columnVisibility;
  const movable = declared
    .filter((c) => !c.fixed)
    .map(({ key, label, fixed, visible }) => ({
      key,
      label,
      fixed,
      visible: visibility[key] ?? visible,
    }));
  const byKey = new Map(movable.map((c) => [c.key, c]));
  const known = new Set(preferences.columnOrder.filter((key) => byKey.has(key)));

  const ordered: Column[] = [...known].map((key) => byKey.get(key)!);
  movable.forEach((column, i) => {
    if (known.has(column.key)) return;
    const predecessor = movable[i - 1]?.key;
    const at = ordered.findIndex((c) => c.key === predecessor);
    ordered.splice(at + 1, 0, column);
  });
  return interleave(declared, ordered);
}

export function columnOrder(columns: readonly Column[]): ColumnOrderState {
  return columns.map((c) => c.key);
}

export function columnVisibility(columns: readonly Column[]): ColumnVisibilityState {
  return Object.fromEntries(columns.map((c) => [c.key, c.visible]));
}

export function encode(columns: readonly Column[]): StoredColumns {
  return { v: 1, columnOrder: columnOrder(columns), columnVisibility: columnVisibility(columns) };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isVisibilityMap = (value: unknown): value is Record<string, boolean> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === 'boolean');

/** Parses stored preferences; anything that is not the current format is `null`. */
export function decode(raw: string | null): StoredColumns | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { v, columnOrder: order, columnVisibility: visibility } = value as Record<string, unknown>;
  if (v !== 1 || !isStringArray(order) || !isVisibilityMap(visibility)) return null;
  return { v, columnOrder: order, columnVisibility: visibility };
}

/** 1-based `:nth-child` indices of hidden keys; unkeyed header cells count too. */
export function hiddenIndices(
  headerKeys: readonly (string | null)[],
  hidden: ReadonlySet<string>,
): number[] {
  return headerKeys.flatMap((key, i) => (key !== null && hidden.has(key) ? [i + 1] : []));
}
