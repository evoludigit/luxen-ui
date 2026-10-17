import { property } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { cls, getPrefix } from '../../registry.js';
import { nextSorting, sortingFromHeaders, type SortingState } from './sort-state.js';
import {
  SelectionState,
  selectedKeys,
  toRowSelection,
  type RowSelectionState,
} from './selection-state.js';
import {
  columnOrder,
  columnVisibility,
  decode,
  encode,
  fromHeaders,
  hiddenIndices,
  merge,
  type Column,
  type ColumnDeclaration,
  type ColumnOrderState,
  type ColumnPreferences,
  type ColumnVisibilityState,
} from './column-state.js';

export type { ColumnSort, SortingState } from './sort-state.js';
export type { RowSelectionState } from './selection-state.js';
export type { Column, ColumnOrderState, ColumnVisibilityState } from './column-state.js';

/**
 * Fired when a sortable header's button is activated. Reports the sort the page
 * should apply, as TanStack Table's `SortingState`; the element changes nothing
 * itself, so there is nothing to cancel — the page renders `aria-sort` and the
 * rows.
 */
export class SortChangeEvent extends Event {
  readonly sorting: SortingState;
  constructor(sorting: SortingState) {
    super('sort-change', { bubbles: false, composed: false, cancelable: false });
    this.sorting = sorting;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'sort-change': SortChangeEvent;
  }
}

/**
 * Fired when the user changes the selection, as TanStack Table's
 * `RowSelectionState`. Not fired when the page sets `rowSelection`,
 * `allMatching` or calls `clearSelection()`.
 */
export class DataTableSelectionChangeEvent extends Event {
  readonly rowSelection: RowSelectionState;
  readonly allMatching: boolean;
  readonly allPageRowsSelected: boolean;
  constructor(rowSelection: RowSelectionState, allMatching: boolean, allPageRowsSelected: boolean) {
    super('selection-change', { bubbles: false, composed: false, cancelable: false });
    this.rowSelection = rowSelection;
    this.allMatching = allMatching;
    this.allPageRowsSelected = allPageRowsSelected;
  }
}

/**
 * Fired when the columns change through the user (a column manager), a reset
 * from it, or preferences restored from `persist-key`, as TanStack Table's
 * `ColumnOrderState` and `ColumnVisibilityState`. Not fired when the page sets
 * `columnOrder` or `columnVisibility`, or calls `resetColumns()`. The page
 * renders its columns in `columnOrder`; hiding is applied by the element.
 */
export class ColumnChangeEvent extends Event {
  readonly columnOrder: ColumnOrderState;
  readonly columnVisibility: ColumnVisibilityState;
  constructor(columns: readonly Column[]) {
    super('column-change', { bubbles: false, composed: false, cancelable: false });
    this.columnOrder = columnOrder(columns);
    this.columnVisibility = columnVisibility(columns);
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'column-change': ColumnChangeEvent;
  }
}

/**
 * Internal contract: a column manager asks the table to apply the user's
 * columns (`null` = reset to the header's defaults). Not public API.
 */
export class ColumnsRequestEvent extends Event {
  readonly columns: readonly Column[] | null;
  constructor(columns: readonly Column[] | null) {
    super('columns-request', { bubbles: false, composed: false, cancelable: false });
    this.columns = columns;
  }
}

interface DataTableEventMap {
  'selection-change': DataTableSelectionChangeEvent;
}

let scopes = 0;

const ROW_INPUTS = ':scope > table > tbody > tr > [data-select] input';
const HEADER_SELECT = ':scope > table > thead > tr > [data-select]';
const HEADER_ROW = ':scope > table > thead > tr';

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
 * Do not bind `checked` on the row inputs: set `rowSelection` instead.
 *
 * The sort, selection and columns travel in TanStack Table's state shapes
 * (`SortingState`, `RowSelectionState`, `ColumnOrderState`,
 * `ColumnVisibilityState`), so a page can pass them to TanStack Table or map
 * them to its query as they are.
 *
 * Columns are the keyed headers (`th[data-key]`, `data-fixed`, `data-hidden`).
 * The element hides columns with a stylesheet of its own and reports order
 * changes in `column-change` for the page to render; it never moves a cell.
 * With `persist-key`, the user's columns are kept in `localStorage`.
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
 * @event sort-change - Fired when a sortable header is activated. Not cancelable. Properties: `sorting: { id, desc }[]` (at most one entry).
 * @event selection-change - Fired when the user changes the selection. Not cancelable. Properties: `rowSelection: Record<string, boolean>`, `allMatching: boolean`, `allPageRowsSelected: boolean`.
 * @event column-change - Fired when the user changes the columns, or stored ones are restored. Not cancelable. Properties: `columnOrder: string[]`, `columnVisibility: Record<string, boolean>`.
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

  /** Keeps the user's column order and visibility in `localStorage` under this name. */
  @property({ attribute: 'persist-key', reflect: true })
  persistKey?: string;

  /** The header's columns as first seen, plus any added since: what a reset restores. */
  private _defaults: Column[] | null = null;
  private _columns: readonly Column[] = [];
  private _sheet: CSSStyleSheet | null = null;
  private _sheetRoot: Document | ShadowRoot | null = null;
  private _sheetText = '';
  private readonly _scope = String(++scopes);

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
  get sorting(): SortingState {
    return sortingFromHeaders(
      [...this.querySelectorAll<HTMLElement>(':scope > table > thead > tr > th[data-key]')].map(
        (th) => ({ key: th.dataset.key!, ariaSort: th.getAttribute('aria-sort') }),
      ),
    );
  }

  /** Selected row values, including rows that are not in the table right now. */
  get rowSelection(): RowSelectionState {
    return toRowSelection(this._selection.keys);
  }

  set rowSelection(selection: RowSelectionState) {
    this._selection.set(selectedKeys(selection));
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

  /** The keyed columns in display order, with their labels: what a column manager lists. */
  get columns(): readonly Column[] {
    return this._columns;
  }

  /** Every keyed column, in display order. Setting it applies without an event; fixed columns keep their place. */
  get columnOrder(): ColumnOrderState {
    return columnOrder(this._columns);
  }

  set columnOrder(order: ColumnOrderState) {
    this._applyPreferences({ columnOrder: order });
  }

  /**
   * Visibility by column key. Setting it replaces the whole state, as in TanStack
   * Table: a key it leaves out is visible. Applies without an event.
   */
  get columnVisibility(): ColumnVisibilityState {
    return columnVisibility(this._columns);
  }

  set columnVisibility(visibility: ColumnVisibilityState) {
    const partial: Readonly<Partial<Record<string, boolean>>> = visibility;
    if (!this._defaults) this._syncColumns();
    this._applyPreferences({
      columnVisibility: Object.fromEntries(
        (this._defaults ?? []).map((c) => [c.key, partial[c.key] ?? true]),
      ),
    });
  }

  /** Restores the header's default columns. No event; stored columns stay. */
  resetColumns(): void {
    this._applyColumns(null);
  }

  // --- Lifecycle ---

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
    this.addEventListener('change', this._onChange);
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('columns-request', this._onColumnsRequest);
    this.dataset.columnScope = this._scope;
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
    this.removeEventListener('columns-request', this._onColumnsRequest);
    this._releaseSheet();
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

  private _sync() {
    this._syncColumns();
    if (this.selectable) this._syncSelection();
  }

  /** Brings the inputs in line with the selection; writes only what differs. */
  private _syncSelection() {
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

  // --- Columns ---

  private _declarations(): ColumnDeclaration[] {
    const row = this.querySelector(HEADER_ROW);
    if (!row) return [];
    return [...row.querySelectorAll<HTMLElement>(':scope > th[data-key]')].map((th) => ({
      key: th.dataset.key!,
      label: (th.getAttribute('aria-label') ?? th.textContent ?? '').trim(),
      fixed: th.hasAttribute('data-fixed'),
      hidden: th.hasAttribute('data-hidden'),
    }));
  }

  private get _storageKey(): string | null {
    return this.persistKey ? `${getPrefix().element}-data-table:${this.persistKey}` : null;
  }

  /** Keeps defaults and columns in step with the header the page renders. */
  private _syncColumns() {
    const declarations = this._declarations();
    if (declarations.length === 0) return;
    const first = this._defaults === null;
    const known = new Map((this._defaults ?? []).map((c) => [c.key, c]));
    const present = new Set(declarations.map((d) => d.key));
    // Defaults keep their first-seen order; labels follow the page (a locale
    // change), and columns the page adds later join at the end.
    this._defaults = [
      ...(this._defaults ?? []).filter((c) => present.has(c.key)),
      ...fromHeaders(declarations.filter((d) => !known.has(d.key))),
    ];
    const labels = new Map(declarations.map((d) => [d.key, d.label]));
    this._defaults = this._defaults.map((c) => ({ ...c, label: labels.get(c.key) ?? c.label }));

    if (first) {
      const stored = this._read();
      this._setColumns(merge(this._defaults, stored));
      if (stored && JSON.stringify(this._columns) !== JSON.stringify(this._defaults)) {
        queueMicrotask(() => this.dispatchEvent(new ColumnChangeEvent(this._columns)));
      }
    } else {
      this._setColumns(merge(this._defaults, encode(this._columns)));
    }
  }

  /**
   * Applies columns and, when they differ, tells a column manager through the
   * internal `columns-update` event — a page setting `columns` fires no public
   * event, but the manager must still follow.
   */
  private _setColumns(columns: readonly Column[]) {
    const changed = JSON.stringify(columns) !== JSON.stringify(this._columns);
    this._columns = columns;
    this._applyHiding();
    if (changed) this.dispatchEvent(new Event('columns-update'));
  }

  /** Normalises requested columns against the header: unknown keys dropped, fixed ones kept. */
  private _applyColumns(columns: readonly Column[] | null) {
    if (!this._defaults) this._syncColumns();
    if (!this._defaults) return;
    this._setColumns(columns === null ? this._defaults : merge(this._defaults, encode(columns)));
  }

  /** Applies part of the column state, the rest staying as it is. */
  private _applyPreferences(changes: Partial<ColumnPreferences>) {
    if (!this._defaults) this._syncColumns();
    if (!this._defaults) return;
    this._setColumns(merge(this._defaults, { ...encode(this._columns), ...changes }));
  }

  private _onColumnsRequest = (e: Event) => {
    const { columns } = e as ColumnsRequestEvent;
    this._applyColumns(columns);
    this._write(columns === null ? null : this._columns);
    this.dispatchEvent(new ColumnChangeEvent(this._columns));
  };

  private _read() {
    const key = this._storageKey;
    if (!key) return null;
    try {
      return decode(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  private _write(columns: readonly Column[] | null) {
    const key = this._storageKey;
    if (!key) return;
    try {
      if (columns === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(encode(columns)));
    } catch {
      // Storage refused (private mode, quota): the columns still apply for this page.
    }
  }

  /** One stylesheet on the element's own root — document or shadow root (spike S5). */
  private _applyHiding() {
    const row = this.querySelector(HEADER_ROW);
    const hidden = new Set(this._columns.filter((c) => !c.visible).map((c) => c.key));
    const keys = row
      ? [...row.children].map((cell) => (cell as HTMLElement).dataset.key ?? null)
      : [];
    // The <col> too: columns are positional, so a width set on a hidden column's
    // <col> would otherwise land on the column that slides into its place.
    const table = `[data-column-scope="${this._scope}"] > table`;
    const text = hiddenIndices(keys, hidden)
      .map(
        (i) =>
          `${table} > :is(thead, tbody, tfoot) > tr > :nth-child(${i}), ${table} > colgroup > col:nth-child(${i}) { display: none; }`,
      )
      .join('\n');
    if (text === this._sheetText) return;
    this._sheetText = text;
    if (!this._sheet) {
      const root = this.getRootNode() as Document | ShadowRoot;
      if (!('adoptedStyleSheets' in root)) return;
      this._sheet = new CSSStyleSheet();
      this._sheetRoot = root;
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this._sheet];
    }
    this._sheet.replaceSync(text);
  }

  private _releaseSheet() {
    if (this._sheet && this._sheetRoot) {
      this._sheetRoot.adoptedStyleSheets = this._sheetRoot.adoptedStyleSheets.filter(
        (sheet) => sheet !== this._sheet,
      );
    }
    this._sheet = null;
    this._sheetRoot = null;
    this._sheetText = '';
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
    this.dispatchEvent(new SortChangeEvent(nextSorting(this.sorting, th.dataset.key!)));
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
          toRowSelection(this._selection.keys),
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
