/**
 * The items of a board, grouped by list, and the move that a `move-request`
 * describes. Pure functions over immutable records: a move that changes
 * nothing returns the state it was given, so callers can compare by identity.
 *
 * The state has the grouped shape of `@dnd-kit/helpers`' `move()`
 * (https://github.com/clauderic/dnd-kit/blob/main/packages/helpers/src/move.ts):
 * item keys by list value, each key a string, a number or an `{ id }` object,
 * matched by its string form. The one difference: dnd-kit works the position
 * out from its drag manager, while a `BoardMove` names it. `index` is the
 * item's final index in `to`, counted after it has left `from`, as in
 * `arrayMove` and Angular CDK's `currentIndex`.
 *
 * No DOM: a page, a store or a server can apply the same move.
 */

/** An item's key in the state: its `value`, or an object carrying it as `id`. */
export type BoardItemKey = string | number | { readonly id: string | number };

/** Item keys by list value, as `@dnd-kit/helpers`' grouped `move()` takes them. */
export type BoardState<T extends BoardItemKey = string> = Readonly<Record<string, readonly T[]>>;

/** A move of one item between lists. A `move-request` event is one. */
export interface BoardMove {
  readonly value: string;
  readonly from: { readonly value: string };
  readonly to: { readonly value: string };
  /** Final position of the item in `to`, after it has left `from`. */
  readonly index: number;
}

const keyOf = (key: BoardItemKey) => String(typeof key === 'object' ? key.id : key);

/** Applies `m` to `state`: moves the item from list `from` to `index` in list `to`. */
export function move<T extends BoardItemKey>(state: BoardState<T>, m: BoardMove): BoardState<T> {
  const from = state[m.from.value];
  const to = state[m.to.value];
  if (!from || !to) return state;
  const at = from.findIndex((key) => keyOf(key) === m.value);
  if (at === -1) return state;
  const rest = [...from];
  const [item] = rest.splice(at, 1);
  if (m.from.value === m.to.value) {
    const index = clamp(m.index, rest.length);
    if (index === at) return state;
    rest.splice(index, 0, item);
    return { ...state, [m.from.value]: rest };
  }
  const moved = [...to];
  moved.splice(clamp(m.index, to.length), 0, item);
  return { ...state, [m.from.value]: rest, [m.to.value]: moved };
}

const clamp = (index: number, length: number) => Math.min(Math.max(index, 0), length);
