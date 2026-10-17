import { html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { cls, tagName, uniqueId } from '../../registry.js';
import { move, setVisible, type Column } from '../data-table/column-state.js';
import { ColumnsRequestEvent, type DataTable } from '../data-table/data-table.js';

type Control = 'up' | 'down' | 'eye';

/**
 * @summary Lets the user show, hide and reorder the columns of an `l-data-table`.
 *
 * Point `for` at the table's `id`; place the manager wherever it fits — in an
 * `l-popover`, an `l-drawer`, a settings panel. It lists the shown, hidden and
 * fixed columns. Each movable column has an eye button, and the shown ones have
 * move up and down buttons, so reordering never depends on dragging (WCAG 2.2
 * SC 2.5.7); Alt with ↑ or ↓ moves the focused column too, and drag and drop
 * works between and within the lists. Every change goes through the table,
 * which applies it, keeps it under its `persist-key` and fires `column-change`.
 * Moves and visibility changes are announced in a polite live region.
 *
 * @example
 * ```html
 * <button class="l-button" id="columns-trigger">Columns</button>
 * <l-popover for="columns-trigger">
 *   <l-column-manager for="products"></l-column-manager>
 * </l-popover>
 * <l-data-table id="products" persist-key="products">…</l-data-table>
 * ```
 *
 * @cssClass .l-column-manager-title - Heading of a list.
 * @cssClass .l-column-manager-list - A list of columns: shown, hidden or fixed (`data-list`).
 * @cssClass .l-column-manager-item - One column; `data-dragging` while it is dragged.
 * @cssClass .l-column-manager-control - A move or eye button (`data-control="up|down|eye"`).
 * @cssClass .l-column-manager-reset - The reset button.
 *
 * @customElement l-column-manager
 */
export class ColumnManager extends LuxenElement {
  private _localize = new LocalizeController(this);

  override createRenderRoot() {
    return this;
  }

  /** `id` of the `l-data-table` whose columns this manager edits. */
  @property({ reflect: true })
  for?: string;

  @state() private _columns: readonly Column[] = [];
  @state() private _announcement = '';

  private _table: DataTable | null = null;
  private _dragKey: string | null = null;
  private _focus: { key: string; control: Control } | null = null;
  private readonly _ids = {
    shown: uniqueId('column-manager-shown'),
    hidden: uniqueId('column-manager-hidden'),
    fixed: uniqueId('column-manager-fixed'),
  };

  override connectedCallback() {
    super.connectedCallback();
    this._bind();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unbind();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('for')) this._bind();
    if (this._focus) this._restoreFocus();
  }

  // --- Table ---

  private _bind() {
    this._unbind();
    const root = this.getRootNode() as Document | ShadowRoot;
    const target = this.for ? root.getElementById?.(this.for) : null;
    if (!target || target.localName !== tagName('data-table')) {
      this._columns = [];
      return;
    }
    this._table = target as DataTable;
    this._table.addEventListener('columns-update', this._refresh);
    this._table.addEventListener('column-change', this._refresh);
    void customElements.whenDefined(tagName('data-table')).then(this._refresh);
    this._refresh();
  }

  private _unbind() {
    this._table?.removeEventListener('columns-update', this._refresh);
    this._table?.removeEventListener('column-change', this._refresh);
    this._table = null;
  }

  private _refresh = () => {
    this._columns = this._table?.columns ?? [];
  };

  private _request(columns: readonly Column[] | null, announcement: string) {
    if (!this._table) return;
    this._table.dispatchEvent(new ColumnsRequestEvent(columns));
    this._refresh();
    // Clear first so the same message repeated is announced again.
    this._announcement = '';
    void this.updateComplete.then(() => {
      this._announcement = announcement;
    });
  }

  // --- Actions ---

  private _shown() {
    return this._columns.filter((c) => !c.fixed && c.visible);
  }

  private _moveShown(key: string, step: -1 | 1, control: Control) {
    const shown = this._shown();
    const index = shown.findIndex((c) => c.key === key);
    const neighbour = shown[index + step];
    if (!neighbour) return;
    const movable = this._columns.filter((c) => !c.fixed);
    const next = move(
      this._columns,
      key,
      movable.findIndex((c) => c.key === neighbour.key),
    );
    const column = shown[index];
    this._focus = { key, control };
    this._request(
      next,
      this._localize.term('columnPosition', column.label, index + step + 1, shown.length),
    );
  }

  private _toggle(column: Column) {
    this._focus = { key: column.key, control: 'eye' };
    this._request(
      setVisible(this._columns, column.key, !column.visible),
      this._localize.term(column.visible ? 'columnHidden' : 'columnShown', column.label),
    );
  }

  private _reset = () => {
    this._request(null, this._localize.term('columnsReset'));
  };

  private _onItemKeyDown(e: KeyboardEvent, column: Column) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !column.visible) return;
    e.preventDefault();
    const control = ((e.target as HTMLElement).dataset.control as Control | undefined) ?? 'eye';
    this._moveShown(column.key, e.key === 'ArrowUp' ? -1 : 1, control);
  }

  private _restoreFocus() {
    const { key, control } = this._focus!;
    this._focus = null;
    const item = [...this.querySelectorAll<HTMLElement>('li[data-key]')].find(
      (li) => li.dataset.key === key,
    );
    const wanted = item?.querySelector<HTMLButtonElement>(`[data-control="${control}"]`);
    const target =
      wanted && !wanted.disabled
        ? wanted
        : item?.querySelector<HTMLButtonElement>('[data-control="eye"]');
    target?.focus();
  }

  // --- Drag and drop ---

  private _onDragStart(e: DragEvent, column: Column) {
    this._dragKey = column.key;
    e.dataTransfer?.setData('text/plain', column.key);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).dataset.dragging = '';
  }

  private _onDragEnd = (e: DragEvent) => {
    this._dragKey = null;
    delete (e.currentTarget as HTMLElement).dataset.dragging;
  };

  private _onDragOver = (e: DragEvent) => {
    if (this._dragKey) e.preventDefault();
  };

  private _onDrop(e: DragEvent, list: 'shown' | 'hidden') {
    const key = this._dragKey;
    if (!key) return;
    e.preventDefault();
    this._dragKey = null;
    const dragged = this._columns.find((c) => c.key === key)!;
    let next = setVisible(this._columns, key, list === 'shown');
    const target = (e.target as Element).closest<HTMLElement>('li[data-key]');
    if (target && target.dataset.key !== key) {
      const movable = next.filter((c) => !c.fixed);
      next = move(
        next,
        key,
        movable.findIndex((c) => c.key === target.dataset.key),
      );
    }
    if (next === this._columns) return;
    const shown = next.filter((c) => !c.fixed && c.visible);
    const announcement =
      dragged.visible === (list === 'shown')
        ? this._localize.term(
            'columnPosition',
            dragged.label,
            shown.findIndex((c) => c.key === key) + 1,
            shown.length,
          )
        : this._localize.term(list === 'shown' ? 'columnShown' : 'columnHidden', dragged.label);
    this._request(next, announcement);
  }

  // --- Render ---

  private _item(column: Column, index: number, count: number) {
    const t = this._localize;
    const label = column.label;
    return html`<li
      class=${cls('column-manager-item')}
      data-key=${column.key}
      draggable="true"
      @dragstart=${(e: DragEvent) => this._onDragStart(e, column)}
      @dragend=${this._onDragEnd}
      @keydown=${(e: KeyboardEvent) => this._onItemKeyDown(e, column)}
    >
      <span>${label}</span>
      ${column.visible
        ? html`<button
              type="button"
              class=${cls('column-manager-control')}
              data-control="up"
              aria-label=${t.term('moveColumnUp', label)}
              ?disabled=${index === 0}
              @click=${() => this._moveShown(column.key, -1, 'up')}
            ></button>
            <button
              type="button"
              class=${cls('column-manager-control')}
              data-control="down"
              aria-label=${t.term('moveColumnDown', label)}
              ?disabled=${index === count - 1}
              @click=${() => this._moveShown(column.key, 1, 'down')}
            ></button>`
        : nothing}
      <button
        type="button"
        class=${cls('column-manager-control')}
        data-control="eye"
        data-visible=${column.visible ? 'true' : 'false'}
        aria-label=${t.term(column.visible ? 'hideColumn' : 'showColumn', label)}
        @click=${() => this._toggle(column)}
      ></button>
    </li>`;
  }

  private _list(kind: 'shown' | 'hidden', columns: readonly Column[]) {
    const t = this._localize;
    return html`<p
        id=${this._ids[kind]}
        class=${cls('column-manager-title')}
      >
        ${t.term(kind === 'shown' ? 'shownColumns' : 'hiddenColumns')}
      </p>
      <ul
        class=${cls('column-manager-list')}
        data-list=${kind}
        aria-labelledby=${this._ids[kind]}
        @dragover=${this._onDragOver}
        @drop=${(e: DragEvent) => this._onDrop(e, kind)}
      >
        ${columns.map((c, i) => this._item(c, i, columns.length))}
      </ul>
      ${columns.length === 0
        ? html`<p class=${cls('column-manager-hint')}>${t.term('dropColumnHere')}</p>`
        : nothing}`;
  }

  override render() {
    const t = this._localize;
    const shown = this._shown();
    const hidden = this._columns.filter((c) => !c.fixed && !c.visible);
    const fixed = this._columns.filter((c) => c.fixed);
    return html`${this._list('shown', shown)} ${this._list('hidden', hidden)}
      ${fixed.length
        ? html`<p
              id=${this._ids.fixed}
              class=${cls('column-manager-title')}
            >
              ${t.term('fixedColumns')}
            </p>
            <ul
              class=${cls('column-manager-list')}
              data-list="fixed"
              aria-labelledby=${this._ids.fixed}
            >
              ${fixed.map(
                (c) =>
                  html`<li
                    class=${cls('column-manager-item')}
                    data-key=${c.key}
                  >
                    <span>${c.label}</span>
                  </li>`,
              )}
            </ul>`
        : nothing}
      <button
        type="button"
        class=${cls('column-manager-reset')}
        @click=${this._reset}
      >
        ${t.term('resetColumns')}
      </button>
      <div
        role="status"
        class=${cls('visually-hidden')}
      >
        ${this._announcement}
      </div>`;
  }
}
