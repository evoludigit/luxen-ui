/**
 * Column order and visibility of a data table, and their stored form. Pure
 * functions over immutable arrays: an operation that changes nothing returns
 * the array it was given, so callers can compare by identity.
 *
 * Fixed columns never move and never hide; the others are reordered among
 * themselves, the fixed ones keeping their declared places.
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

/** Stored preferences. `order` and `hidden` list movable columns only. */
export interface StoredColumns {
  readonly v: 1;
  readonly order: readonly string[];
  readonly hidden: readonly string[];
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
 * Applies stored preferences to the columns the header declares now. Stored
 * keys the header no longer has are dropped; a declared column the store does
 * not know keeps its declared visibility and sits after its declared predecessor.
 */
export function merge(
  declared: readonly Column[],
  stored: StoredColumns | null,
): readonly Column[] {
  if (!stored) return declared;
  const movable = declared.filter((c) => !c.fixed);
  const byKey = new Map(movable.map((c) => [c.key, c]));
  const hidden = new Set(stored.hidden);
  const known = new Set(stored.order.filter((key) => byKey.has(key)));

  const ordered: Column[] = [...known].map((key) => {
    const { label, fixed } = byKey.get(key)!;
    return { key, label, fixed, visible: !hidden.has(key) };
  });
  movable.forEach((column, i) => {
    if (known.has(column.key)) return;
    const predecessor = movable[i - 1]?.key;
    const at = ordered.findIndex((c) => c.key === predecessor);
    ordered.splice(at + 1, 0, column);
  });
  return interleave(declared, ordered);
}

export function encode(columns: readonly Column[]): StoredColumns {
  const movable = columns.filter((c) => !c.fixed);
  return {
    v: 1,
    order: movable.map((c) => c.key),
    hidden: movable.filter((c) => !c.visible).map((c) => c.key),
  };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

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
  const { v, order, hidden } = value as Record<string, unknown>;
  if (v !== 1 || !isStringArray(order) || !isStringArray(hidden)) return null;
  return { v, order, hidden };
}

/** 1-based `:nth-child` indices of hidden keys; unkeyed header cells count too. */
export function hiddenIndices(
  headerKeys: readonly (string | null)[],
  hidden: ReadonlySet<string>,
): number[] {
  return headerKeys.flatMap((key, i) => (key !== null && hidden.has(key) ? [i + 1] : []));
}
