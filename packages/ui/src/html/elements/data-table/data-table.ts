import { property } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { focusFromInput } from '../../shared/input-modality.js';
import { cls, getPrefix } from '../../registry.js';
import { rowTarget } from './row-navigation.js';
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

/** Sets `tabindex` (`null` removes it), writing only when it differs. */
function setTabIndex(el: HTMLElement, value: string | null) {
  if (el.getAttribute('tabindex') === value) return;
  if (value === null) el.removeAttribute('tabindex');
  else el.setAttribute('tabindex', value);
}

const ROW_INPUTS = ':scope > table > tbody > tr > [data-select] input';
const HEADER_SELECT = ':scope > table > thead > tr > [data-select]';
const HEADER_ROW = ':scope > table > thead > tr';
const BODY_ROWS = ':scope > table > tbody > tr';
/** What a click on a row should leave to the control it hit. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [tabindex]:not(tr)';
/** What in a row can take focus: taken out of the Tab sequence while its row isn't the stop. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, iframe, [contenteditable]:not([contenteditable="false"]), [tabindex]:not(tr)';

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
 * With `navigable`, an opt-in for keyboard work through a list, the body is one
 * tab stop (the row last reached, then its own controls; the other rows'
 * controls leave the Tab sequence, so don't bind `tabindex` on them). ↑ and ↓
 * move between rows, Home and End go to the first and last, Page Up and Page
 * Down move ten rows. With `selectable`, Space toggles the row, Shift with a
 * move key selects from where the Shift run started (moving back shrinks it),
 * Ctrl or Cmd with A selects the page's rows, and Escape clears the selection
 * (with checkboxes). Enter follows the row link, keeping Ctrl, Cmd or Shift.
 * Rows keep their place by input value, else `id`; a removed focused row hands
 * focus to its neighbour. Rows only: the table keeps table semantics, and keys
 * pressed on a control inside a row are left to it.
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

  /**
   * Makes the body one tab stop and its rows reachable and selectable from the
   * keyboard, one row at a time (roving focus on the `<tr>` elements, which keep
   * table semantics). Off by default.
   */
  @property({ type: Boolean, reflect: true })
  navigable = false;

  /**
   * Keeps the user's column order and visibility in `localStorage` under this
   * name. Changing it applies the columns stored under the new name.
   */
  @property({ attribute: 'persist-key', reflect: true })
  persistKey?: string;

  /** The storage key the current columns were restored from. */
  private _restoredKey: string | null = null;

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
  /** With `navigable`: the key of the row that is the body's tab stop. */
  private _focusKey: string | null = null;
  /**
   * Whether focus is in the rows (a row or a control in one), so a re-render
   * that drops it to `<body>` puts it back on a row.
   */
  private _focusInRows = false;
  /** The focused row's place, for a neighbour to take over when the row goes. */
  private _focusIndex = -1;
  private _focusOutTimer = 0;
  private _warnedKeyless = false;
  /** Rows this element gave a `tabindex`, removed again when navigation stops. */
  private readonly _tabRows = new Set<HTMLTableRowElement>();
  /** Controls in the rows, with the `tabindex` they had before this element wrote one. */
  private readonly _controlTabs = new Map<HTMLElement, string | null>();

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
    this.addEventListener('focusin', this._onFocusIn);
    this.addEventListener('focusout', this._onFocusOut);
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
    clearTimeout(this._focusOutTimer);
    this._observer?.disconnect();
    this._observer = null;
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('columns-request', this._onColumnsRequest);
    this.removeEventListener('focusin', this._onFocusIn);
    this.removeEventListener('focusout', this._onFocusOut);
    this._releaseSheet();
    this._releaseRows();
  }

  // LocalizeController requests an update when the language changes.
  override updated(changed: Map<string, unknown>) {
    if (changed.has('selectable') || changed.has('navigable') || changed.has('persistKey')) {
      this._queueSync();
    }
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
    else this._removeAdded();
    this._syncNavigation();
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

    // The mode is only known once a row input exists: until then, add nothing,
    // or a radio table that renders its rows late would get a header checkbox.
    if (mode === 'single') this._removeAdded();
    const all = inputs.length > 0 || this._added ? this._headerInput(mode) : null;
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

  private _removeAdded() {
    this._added?.remove();
    this._added = null;
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

    // On the first sync, and whenever persist-key changes, the stored columns
    // replace the current ones and are reported once, for the page to render.
    const key = this._storageKey;
    if (first || key !== this._restoredKey) {
      this._restoredKey = key;
      const before = first ? this._defaults : this._columns;
      this._setColumns(merge(this._defaults, this._read()));
      if (JSON.stringify(this._columns) !== JSON.stringify(before)) {
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

  /** One stylesheet on the element's own root — document or shadow root. */
  private _applyHiding() {
    const row = this.querySelector(HEADER_ROW);
    const hidden = new Set(this._columns.filter((c) => !c.visible).map((c) => c.key));
    const keys = row
      ? [...row.children].map((cell) => (cell as HTMLElement).dataset.key ?? null)
      : [];
    // The <col> too: columns are positional, so a width set on a hidden column's
    // <col> would otherwise land on the column that slides into its place. Rows
    // with a spanning cell (an empty state, a group heading) don't follow the
    // header's positions and are left alone.
    const table = `[data-column-scope="${this._scope}"] > table`;
    const text = hiddenIndices(keys, hidden)
      .map(
        (i) =>
          `${table} > :is(thead, tbody, tfoot) > tr:not(:has(> [colspan])) > :nth-child(${i}), ${table} > colgroup > col:nth-child(${i}) { display: none; }`,
      )
      .join('\n');
    if (text === this._sheetText) return;
    if (!this._sheet) {
      // Detached, the root is no document: the sheet is adopted on connect.
      const root = this.getRootNode() as Document | ShadowRoot;
      if (!('adoptedStyleSheets' in root)) return;
      this._sheet = new CSSStyleSheet();
      this._sheetRoot = root;
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this._sheet];
    }
    this._sheetText = text;
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

  // --- Row navigation ---

  /** The rows navigation moves through: body rows, less those made of one spanning cell. */
  private _navRows(): HTMLTableRowElement[] {
    return [...this.querySelectorAll<HTMLTableRowElement>(BODY_ROWS)].filter(
      (tr) => !tr.querySelector(':scope > [colspan]'),
    );
  }

  /** A row's identity across re-renders: its input's value, else its `id`, else its place. */
  private _rowKey(tr: HTMLTableRowElement, rows = this._navRows()): string {
    const input = tr.querySelector<HTMLInputElement>(':scope > [data-select] input');
    return input?.value || (tr.id ? `#${tr.id}` : `@${rows.indexOf(tr)}`);
  }

  /** The navigable row an event happened in, if it is one of this table's. */
  private _navRowOf(target: EventTarget | null): HTMLTableRowElement | null {
    if (!(target instanceof Element)) return null;
    const tr = target.closest('tr');
    return tr && this._navRows().includes(tr) ? tr : null;
  }

  /** Picks the row that is the tab stop, roves the rows to it, and restores focus. */
  private _syncNavigation() {
    if (!this.navigable) {
      this._releaseRows();
      return;
    }
    const rows = this._navRows();
    const keys = rows.map((tr) => this._rowKey(tr, rows));
    this._warnIfKeyless(keys);
    const restore =
      this._focusInRows &&
      (document.activeElement === document.body || document.activeElement === null);
    let stop = this._focusKey === null ? 0 : keys.indexOf(this._focusKey);
    if (stop === -1) {
      // The row went: its neighbour takes over, the next one or the previous if it was last.
      stop = Math.min(Math.max(this._focusIndex, 0), rows.length - 1);
      this._focusKey = keys[stop] ?? null;
    }
    this._focusIndex = stop;
    this._rove(rows, stop);
    if (!restore) return;
    if (rows.length > 0) focusFromInput(rows[stop]);
    // Nothing can take focus: drop the claim, so rows that come back never take it.
    else this._focusInRows = false;
  }

  /**
   * One row holds `tabindex="0"`, the others `-1`. The controls of the other rows
   * leave the Tab sequence too, so the body is one tab stop: the row, then its
   * own controls. Writes only what differs.
   */
  private _rove(rows: HTMLTableRowElement[], stop: number) {
    rows.forEach((tr, i) => {
      setTabIndex(tr, i === stop ? '0' : '-1');
      this._tabRows.add(tr);
      for (const control of tr.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        if (!this._controlTabs.has(control)) {
          this._controlTabs.set(control, control.getAttribute('tabindex'));
        }
        setTabIndex(control, i === stop ? this._controlTabs.get(control)! : '-1');
      }
    });
    for (const tr of this._tabRows) {
      if (!tr.isConnected || !rows.includes(tr)) this._tabRows.delete(tr);
    }
    for (const control of this._controlTabs.keys()) {
      if (!control.isConnected) this._controlTabs.delete(control);
    }
  }

  /** Rows kept by their place lose the focused row on a re-sort: say so once. */
  private _warnIfKeyless(keys: string[]) {
    if (this._warnedKeyless || !keys.some((key) => key.startsWith('@'))) return;
    this._warnedKeyless = true;
    // eslint-disable-next-line no-console
    console.warn(
      `<${this.localName} navigable>: rows have neither a selection input value nor an id; the focused row is kept by its position across re-renders. Add an id to each row.`,
    );
  }

  private _releaseRows() {
    for (const tr of this._tabRows) tr.removeAttribute('tabindex');
    this._tabRows.clear();
    for (const [control, authored] of this._controlTabs) setTabIndex(control, authored);
    this._controlTabs.clear();
  }

  private _focusRow(tr: HTMLTableRowElement) {
    this._focusKey = this._rowKey(tr);
    this._syncNavigation();
    focusFromInput(tr);
  }

  private _onFocusIn = (e: FocusEvent) => {
    if (!this.navigable) return;
    const tr = this._navRowOf(e.target);
    if (!tr) return;
    const rows = this._navRows();
    this._focusInRows = true;
    this._focusIndex = rows.indexOf(tr);
    const key = this._rowKey(tr, rows);
    if (key !== this._focusKey) {
      this._focusKey = key;
      this._syncNavigation();
    }
  };

  private _onFocusOut = (e: FocusEvent) => {
    if (e.relatedTarget instanceof Element) {
      if (!this._navRowOf(e.relatedTarget)) this._focusInRows = false;
      return;
    }
    // No new target: Chromium moving or removing the focused node, a click on a
    // blank part of the page, or the window losing focus. Decide after the
    // mutation sync (a microtask) has had its chance to put focus back.
    clearTimeout(this._focusOutTimer);
    // The element's own root: in a shadow root, the document's activeElement is the host.
    this._focusOutTimer = window.setTimeout(() => {
      const root = this.getRootNode() as Document | ShadowRoot;
      if (!this._navRowOf(root.activeElement)) this._focusInRows = false;
    }, 0);
  };

  /** Keys pressed on a row itself; keys on a control inside it stay the control's. */
  private _onRowKey(e: KeyboardEvent, tr: HTMLTableRowElement) {
    if (e.altKey) return;
    if (e.key === 'Enter') {
      this._selection.endRun();
      this._followRowLink(e, tr);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'a') this._selectPage(e);
      return;
    }
    if (!this._onMoveKey(e, tr)) this._onActionKey(e, tr);
  }

  /** The keys that move between rows; with Shift they extend the selection run. */
  private _onMoveKey(e: KeyboardEvent, tr: HTMLTableRowElement): boolean {
    const rows = this._navRows();
    const target = rowTarget(e.key, rows.indexOf(tr), rows.length);
    if (target === null) return false;
    e.preventDefault();
    const next = rows[target];
    if (e.shiftKey) this._extendRun(tr, next);
    else this._selection.endRun();
    this._focusRow(next);
    return true;
  }

  /** Ctrl or Cmd with A: selects the page's rows, as the header checkbox does. */
  private _selectPage(e: KeyboardEvent) {
    if (!this.selectable || this._selection.mode !== 'multiple') return;
    e.preventDefault();
    if (this._selection.setVisible(this._visibleKeys(), true)) {
      this._sync();
      this._reportSelection();
    }
  }

  /**
   * Enter follows the row link as a click with the same modifiers would, so a
   * router or the browser can open the record in a new tab or window.
   */
  private _followRowLink(e: KeyboardEvent, tr: HTMLTableRowElement) {
    const link = tr.querySelector<HTMLAnchorElement>('a[data-row-link]');
    if (!link) return;
    e.preventDefault();
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      }),
    );
  }

  /** Space and Escape on a row. Shift alone keeps a selection run going. */
  private _onActionKey(e: KeyboardEvent, tr: HTMLTableRowElement) {
    if (e.key === 'Shift') return;
    this._selection.endRun();
    if (e.key === ' ') {
      e.preventDefault();
      const input = tr.querySelector<HTMLInputElement>(':scope > [data-select] input');
      if (!input) return;
      this._shiftSpace = e.shiftKey;
      input.click();
    } else if (
      e.key === 'Escape' &&
      this.selectable &&
      this._selection.mode === 'multiple' &&
      this._selection.keys.length > 0
    ) {
      e.preventDefault();
      if (this._selection.clear()) {
        this._sync();
        this._reportSelection();
      }
    }
  }

  private _extendRun(from: HTMLTableRowElement, to: HTMLTableRowElement) {
    if (!this.selectable || from === to) return;
    const input = (tr: HTMLTableRowElement) =>
      tr.querySelector<HTMLInputElement>(':scope > [data-select] input');
    const a = input(from);
    const b = input(to);
    if (!a || !b) return;
    if (this._selection.extend(this._visibleKeys(), a.value, b.value)) {
      this._sync();
      this._reportSelection();
    }
  }

  private _reportSelection() {
    const visible = this._visibleKeys();
    this.dispatchEvent(
      new DataTableSelectionChangeEvent(
        toRowSelection(this._selection.keys),
        this._selection.allMatching,
        visible.length > 0 && this._selection.headerState(visible) === 'all',
      ),
    );
  }

  // --- User actions ---

  private _onClick = (e: MouseEvent) => {
    if (this.navigable) {
      const tr = this._navRowOf(e.target);
      if (tr && !(e.target as Element).closest(INTERACTIVE)) {
        this._selection.endRun();
        this._focusRow(tr);
      }
    }
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
      return;
    }
    if (!this.navigable || e.defaultPrevented) return;
    const tr = this._navRowOf(e.target);
    if (tr && e.target === tr) this._onRowKey(e, tr);
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
    if (changed) this._reportSelection();
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
