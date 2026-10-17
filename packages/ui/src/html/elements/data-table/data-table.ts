import { property } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { cls } from '../../registry.js';
import { nextSort, sortFromHeaders, type SortEntry } from './sort-state.js';
import { SelectionState } from './selection-state.js';

export type { SortDirection, SortEntry } from './sort-state.js';

/**
 * Fired when a sortable header's button is activated. Reports the sort the page
 * should apply; the element changes nothing itself, so there is nothing to
 * cancel — the page renders `aria-sort` and the rows.
 */
export class SortChangeEvent extends Event {
  readonly sort: SortEntry | null;
  constructor(sort: SortEntry | null) {
    super('sort-change', { bubbles: false, composed: false, cancelable: false });
    this.sort = sort;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'sort-change': SortChangeEvent;
  }
}

/**
 * Fired when the user changes the selection. Not fired when the page sets
 * `selectedKeys`, `allMatching` or calls `clearSelection()`.
 */
export class DataTableSelectionChangeEvent extends Event {
  readonly selectedKeys: readonly string[];
  readonly allMatching: boolean;
  readonly allVisibleSelected: boolean;
  constructor(selectedKeys: readonly string[], allMatching: boolean, allVisibleSelected: boolean) {
    super('selection-change', { bubbles: false, composed: false, cancelable: false });
    this.selectedKeys = selectedKeys;
    this.allMatching = allMatching;
    this.allVisibleSelected = allVisibleSelected;
  }
}

interface DataTableEventMap {
  'selection-change': DataTableSelectionChangeEvent;
}

const ROW_INPUTS = ':scope > table > tbody > tr > [data-select] input';
const HEADER_SELECT = ':scope > table > thead > tr > [data-select]';

/**
 * @summary Adds sorting and row selection to the `.l-table` it wraps, leaving rendering to the page.
 *
 * The table stays the page's: the element reads its markup and reports what
 * the user did. A sortable header — a `<th data-key>` holding a `<button>` —
 * fires `sort-change` with the next sort; the page sorts its rows and renders
 * `aria-sort`. With `selectable`, the native checkboxes (or radios) in the
 * `[data-select]` cells gain Shift ranges, a mixed header checkbox and memory
 * of selected rows that leave the page. The header checkbox is added to an
 * empty `th[data-select]` once the script runs, since without it it would do
 * nothing; an authored one is used as is.
 *
 * Do not bind `checked` on the row inputs: set `selectedKeys` instead.
 *
 * @example
 * ```html
 * <l-data-table selectable>
 *   <table class="l-table">
 *     <caption>Products</caption>
 *     <thead>
 *       <tr>
 *         <th scope="col" data-select></th>
 *         <th scope="col" data-key="sku" aria-sort="ascending"><button type="button">SKU</button></th>
 *       </tr>
 *     </thead>
 *     <tbody>
 *       <tr>
 *         <td data-select><input type="checkbox" class="l-checkbox" value="sku-1042" aria-label="Select SKU-1042" /></td>
 *         <th scope="row">SKU-1042</th>
 *       </tr>
 *     </tbody>
 *   </table>
 * </l-data-table>
 * ```
 *
 * @event sort-change - Fired when a sortable header is activated. Not cancelable. Properties: `sort: { key, direction } | null`.
 * @event selection-change - Fired when the user changes the selection. Not cancelable. Properties: `selectedKeys: string[]`, `allMatching: boolean`, `allVisibleSelected: boolean`.
 *
 * @customElement l-data-table
 */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging -- typed addEventListener overloads merged below; no uninitialized properties.
export class DataTable extends LuxenElement {
  private _localize = new LocalizeController(this);

  override createRenderRoot() {
    return this;
  }

  /** Turns on row selection through the native inputs in `[data-select]` cells. */
  @property({ type: Boolean, reflect: true })
  selectable = false;

  private _selection = new SelectionState('multiple');
  private _observer: MutationObserver | null = null;
  private _setupTimer = 0;
  private _syncQueued = false;
  /** Shift held on the Space that toggled a checkbox: Firefox drops it from the click. */
  private _shiftSpace = false;
  /** Whether the input change about to arrive extends a range (click runs before change). */
  private _range = false;
  private _warned = new WeakSet<HTMLInputElement>();
  /** The header checkbox this element added, renamed when the language changes. */
  private _added: HTMLInputElement | null = null;

  /** The sort the markup states, read from the headers' `aria-sort`. */
  get sort(): SortEntry | null {
    return sortFromHeaders(
      [...this.querySelectorAll<HTMLElement>(':scope > table > thead > tr > th[data-key]')].map(
        (th) => ({ key: th.dataset.key!, ariaSort: th.getAttribute('aria-sort') }),
      ),
    );
  }

  /** Selected row values, including rows that are not in the table right now. */
  get selectedKeys(): readonly string[] {
    return this._selection.keys;
  }

  set selectedKeys(keys: readonly string[]) {
    this._selection.set(keys);
    this._queueSync();
  }

  /**
   * True when the page acts on every row matching its query, not only the
   * selected keys — set it from the page's own "select all" control. Cleared by
   * the next change the user makes.
   */
  get allMatching(): boolean {
    return this._selection.allMatching;
  }

  set allMatching(value: boolean) {
    this._selection.allMatching = value;
  }

  clearSelection(): void {
    this._selection.clear();
    this._queueSync();
  }

  // --- Lifecycle ---

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
    this.addEventListener('change', this._onChange);
    this.addEventListener('keydown', this._onKeyDown);
    // Children may not be parsed yet when the element upgrades mid-parse: try
    // synchronously, then retry once on a macrotask (rAF is suspended in hidden
    // documents). The observer also covers a table inserted later.
    this._observer = new MutationObserver(() => this._queueSync());
    this._observer.observe(this, { childList: true, subtree: true });
    this._sync();
    this._setupTimer = window.setTimeout(() => this._sync(), 0);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._setupTimer);
    this._observer?.disconnect();
    this._observer = null;
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('keydown', this._onKeyDown);
  }

  // LocalizeController requests an update when the language changes.
  override updated(changed: Map<string, unknown>) {
    if (changed.has('selectable')) this._queueSync();
    const label = this._localize.term('selectAllRows');
    if (this._added && this._added.getAttribute('aria-label') !== label) {
      this._added.setAttribute('aria-label', label);
    }
  }

  // --- Sync with the page's markup ---

  private _queueSync() {
    if (this._syncQueued) return;
    this._syncQueued = true;
    queueMicrotask(() => {
      this._syncQueued = false;
      this._sync();
    });
  }

  private _rowInputs(): HTMLInputElement[] {
    return [...this.querySelectorAll<HTMLInputElement>(ROW_INPUTS)];
  }

  private _isRowInput(target: EventTarget | null): target is HTMLInputElement {
    return target instanceof HTMLInputElement && this._rowInputs().includes(target);
  }

  private _visibleKeys(inputs = this._rowInputs()): string[] {
    return inputs.map((input) => input.value);
  }

  /** Brings the inputs in line with the selection; writes only what differs. */
  private _sync() {
    if (!this.selectable) return;
    const inputs = this._rowInputs();
    const mode = inputs[0]?.type === 'radio' ? 'single' : 'multiple';
    if (mode !== this._selection.mode) {
      const keys = this._selection.keys;
      this._selection = new SelectionState(mode);
      this._selection.set(keys);
    }

    for (const input of inputs) {
      const checked = this._selection.has(input.value);
      if (input.checked !== checked) input.checked = checked;
      this._warnIfUnnamed(input);
    }

    const all = this._headerInput(mode);
    if (all) {
      const state = this._selection.headerState(this._visibleKeys(inputs));
      if (all.checked !== (state === 'all')) all.checked = state === 'all';
      if (all.indeterminate !== (state === 'some')) all.indeterminate = state === 'some';
    }
  }

  /** The header checkbox: the authored one, or one added to an empty cell. */
  private _headerInput(mode: 'single' | 'multiple'): HTMLInputElement | null {
    const cell = this.querySelector<HTMLElement>(HEADER_SELECT);
    if (!cell || mode === 'single') return null;
    const authored = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (authored) return authored;
    if (cell.childElementCount > 0 || cell.textContent?.trim()) return null;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = cls('checkbox');
    input.setAttribute('aria-label', this._localize.term('selectAllRows'));
    cell.append(input);
    this._added = input;
    return input;
  }

  private _warnIfUnnamed(input: HTMLInputElement) {
    if (this._warned.has(input)) return;
    const named =
      input.hasAttribute('aria-label') ||
      input.hasAttribute('aria-labelledby') ||
      input.labels?.length ||
      input.hasAttribute('title');
    if (named) return;
    this._warned.add(input);
    // eslint-disable-next-line no-console
    console.warn(
      `<${this.localName}>: the selection input for row "${input.value}" has no accessible name; add aria-label.`,
    );
  }

  // --- User actions ---

  private _onClick = (e: MouseEvent) => {
    if (this._isRowInput(e.target)) {
      this._range = e.shiftKey || this._shiftSpace;
      this._shiftSpace = false;
      return;
    }
    const button = (e.target as Element).closest('button');
    const th = button?.parentElement;
    if (
      !button ||
      !th?.matches('th[data-key]') ||
      th.closest('thead')?.closest(this.localName) !== this
    ) {
      return;
    }
    this.dispatchEvent(new SortChangeEvent(nextSort(this.sort, th.dataset.key!)));
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' && this._isRowInput(e.target)) {
      this._shiftSpace = e.shiftKey;
    }
  };

  private _onChange = (e: Event) => {
    if (!this.selectable) return;
    const input = e.target as HTMLInputElement;
    const range = this._range;
    this._range = false;

    let changed: boolean;
    if (this.querySelector(HEADER_SELECT)?.contains(input)) {
      changed = this._selection.setVisible(this._visibleKeys(), input.checked);
    } else if (this._isRowInput(input)) {
      changed = range
        ? this._selection.range(this._visibleKeys(), input.value)
        : this._selection.toggle(input.value);
    } else {
      return;
    }
    this._sync();
    if (changed) {
      const visible = this._visibleKeys();
      this.dispatchEvent(
        new DataTableSelectionChangeEvent(
          this._selection.keys,
          this._selection.allMatching,
          visible.length > 0 && this._selection.headerState(visible) === 'all',
        ),
      );
    }
  };
}

// Type `addEventListener('selection-change', …)` for this element. The name is
// shared with `l-tree`, whose event the global map already declares, so the
// overloads are declaration-merged here instead (the `tabs.ts` pattern). The
// interface MUST come after the class: the CEM analyzer dedups on the first
// declaration of the name.
export interface DataTable {
  addEventListener<K extends keyof DataTableEventMap>(
    type: K,
    listener: (this: DataTable, ev: DataTableEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: DataTable, ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof DataTableEventMap>(
    type: K,
    listener: (this: DataTable, ev: DataTableEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: DataTable, ev: HTMLElementEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}
