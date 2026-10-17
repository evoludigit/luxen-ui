/**
 * Selection state of a data table, keyed on the row inputs' values. It outlives
 * the rows on screen: keys whose rows have left the DOM (another page, a filter)
 * stay selected until the user or the page changes them.
 *
 * `multiple` follows checkboxes; `single` follows radios, so re-selecting the
 * selected row is no change, as with a native radio. Mutators return whether
 * anything changed, so the element fires one event per real change.
 */

export type SelectionMode = 'multiple' | 'single';

/** Selected row keys, as TanStack Table's `RowSelectionState`. */
export type RowSelectionState = Readonly<Record<string, boolean>>;

export function toRowSelection(keys: readonly string[]): RowSelectionState {
  return Object.fromEntries(keys.map((key) => [key, true]));
}

/** The keys a `RowSelectionState` selects: TanStack may keep deselected keys as `false`. */
export function selectedKeys(selection: RowSelectionState): string[] {
  return Object.keys(selection).filter((key) => selection[key]);
}
export type HeaderState = 'none' | 'some' | 'all';

export class SelectionState {
  private readonly _keys = new Set<string>();
  private _anchor: string | null = null;
  private _allMatching = false;

  constructor(readonly mode: SelectionMode) {}

  get keys(): readonly string[] {
    return [...this._keys];
  }

  has(key: string): boolean {
    return this._keys.has(key);
  }

  /**
   * True when the page acts on every row matching its query, not only the keys
   * held here. Set by the page; any change a user makes clears it. Radios never
   * stand for more than one row.
   */
  get allMatching(): boolean {
    return this._allMatching;
  }

  set allMatching(value: boolean) {
    this._allMatching = value && this.mode === 'multiple';
  }

  /** Replaces the selection from outside, without moving the anchor. */
  set(keys: readonly string[]): void {
    this._keys.clear();
    for (const key of this.mode === 'single' ? keys.slice(0, 1) : keys) this._keys.add(key);
    this._anchor = null;
  }

  select(key: string, selected: boolean): boolean {
    if (this._keys.has(key) === selected) return false;
    if (selected && this.mode === 'single') this._keys.clear();
    if (selected) this._keys.add(key);
    else this._keys.delete(key);
    return this._userChange(true);
  }

  /** A click on a row's input. Moves the anchor for the next range. */
  toggle(key: string): boolean {
    this._anchor = key;
    return this.select(key, this.mode === 'single' || !this._keys.has(key));
  }

  /**
   * Shift-click on `to`: gives every visible row between the anchor and `to` the
   * state `to` gets. Without an anchor among the visible rows it is a toggle.
   */
  range(visible: readonly string[], to: string): boolean {
    const from = this._anchor === null ? -1 : visible.indexOf(this._anchor);
    const end = visible.indexOf(to);
    if (this.mode === 'single' || from === -1 || end === -1) return this.toggle(to);
    const selected = this._keys.has(this._anchor!);
    let changed = false;
    for (const key of visible.slice(Math.min(from, end), Math.max(from, end) + 1)) {
      changed = this._apply(key, selected) || changed;
    }
    this._anchor = to;
    return this._userChange(changed);
  }

  /** The header checkbox: selects or clears the visible rows, others untouched. */
  setVisible(visible: readonly string[], selected: boolean): boolean {
    let changed = false;
    for (const key of visible) changed = this._apply(key, selected) || changed;
    return this._userChange(changed);
  }

  clear(): boolean {
    const changed = this._keys.size > 0;
    this._keys.clear();
    this._anchor = null;
    return this._userChange(changed);
  }

  headerState(visible: readonly string[]): HeaderState {
    const selected = visible.filter((key) => this._keys.has(key)).length;
    if (selected === 0) return 'none';
    return selected === visible.length ? 'all' : 'some';
  }

  private _apply(key: string, selected: boolean): boolean {
    if (this._keys.has(key) === selected) return false;
    if (selected) this._keys.add(key);
    else this._keys.delete(key);
    return true;
  }

  private _userChange(changed: boolean): boolean {
    if (!this._allMatching) return changed;
    this._allMatching = false;
    return true;
  }
}
