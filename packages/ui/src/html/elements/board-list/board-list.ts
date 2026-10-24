import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { tagName } from '../../registry.js';
import type { BoardItem } from '../board-item/board-item.js';
import hostStyles from '../../shared/styles/host.styles.js';
import rawStyles from './board-list.css?inline';

const styles = unsafeCSS(rawStyles);

/**
 * Internal: a list's `canDrop` changed, so the board's items re-render the
 * state of their "Move to…" buttons. Bubbles to the board; not composed.
 */
export class BoardListChangeEvent extends Event {
  constructor() {
    super('board-list-change', { bubbles: true, composed: false, cancelable: false });
  }
}

/**
 * One list of an `l-board`, holding `l-board-item`s.
 *
 * It is a drop target for the board's other items, and is named by `label` in
 * their "Move to…" menus and in announcements. While empty it shows a "Drop
 * here" placeholder, which stays a drop target.
 *
 * @summary A list of movable items in an `l-board`.
 *
 * @example
 * ```html
 * <l-board-list label="Standard">
 *   <l-board-item value="sku-1042">Desk lamp</l-board-item>
 * </l-board-list>
 * ```
 *
 * @slot - The `l-board-item`s, directly or inside wrappers.
 * @slot header - Content above the items, in place of the label (which still names the list).
 * @slot footer - Content below the items, e.g. a combobox to add one.
 * @slot empty - The list's own empty state, in place of "Drop here". It stays a drop target.
 *
 * @csspart base - The list's box.
 * @csspart header - The header row.
 * @csspart label - The label, shown when the header slot is empty.
 * @csspart items - The wrapping row of items.
 * @csspart placeholder - The "Drop here" placeholder of an empty list.
 * @csspart footer - The footer row.
 *
 * @cssproperty [--background-color] - The list's fill.
 * @cssproperty [--border-color] - The list's border.
 * @cssproperty [--drop-target-color] - Border and tint of the list while an item is dragged over it.
 *
 * @attribute data-drop-target - Set while an item that may be dropped is dragged over the list.
 *
 * @customElement l-board-list
 */
export class BoardList extends LuxenElement {
  static override styles = [hostStyles, styles];

  private _localize = new LocalizeController(this);

  /** Names the list: its heading, its accessible name, and its entry in "Move to…" menus. */
  @property({ reflect: true })
  accessor label = '';

  /** Identifies the list in `move-request` and as its key in the board's `state`. Required for `move()`, unique within the board. */
  @property({ reflect: true })
  accessor value = '';

  /** Accepts no item: not a drop target, no placeholder, left out of "Move to…" menus. Its own items can still leave. */
  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  /**
   * Which items the list accepts, besides `disabled`: `(item, from) => boolean`.
   * Asked on every drag over the list, each time a "Move to…" menu opens, and
   * when it is set. A full list, say: `list.canDrop = () => list.items.length < 10`.
   */
  @property({ attribute: false })
  accessor canDrop: ((item: BoardItem, from: BoardList) => boolean) | undefined = undefined;

  @state() private accessor _empty = true;
  @state() private accessor _hasHeader = false;
  @state() private accessor _hasFooter = false;

  /** Whether `item`, from another list of the board, may move here: the list is enabled and `canDrop` allows it. */
  accepts(item: BoardItem): boolean {
    const from = item.list;
    if (this.disabled || !from || from === this) return false;
    return this.canDrop?.(item, from) ?? true;
  }

  override updated(changed: PropertyValues<this>) {
    if (changed.has('canDrop')) this.dispatchEvent(new BoardListChangeEvent());
  }

  /** The list's items, in order: its children, or inside elements the page wraps them in. */
  get items(): BoardItem[] {
    return this._itemElements().filter((item) => item.matches(':defined'));
  }

  /** The item elements, upgraded or not: found from the DOM alone. */
  private _itemElements(): BoardItem[] {
    const tag = tagName('board-list');
    return [...this.querySelectorAll<BoardItem>(tagName('board-item'))].filter(
      (item) => item.parentElement?.closest(tag) === this,
    );
  }

  /**
   * @internal Shows the placeholder while the list holds no item, upgraded or
   * not. Runs on `slotchange`, and from the board's sync for items added
   * inside a wrapper, which a slot does not see.
   */
  _updateEmpty() {
    this._empty = this._itemElements().length === 0;
  }

  private _onSlotChange = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const filled = slot
      .assignedNodes()
      .some((n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? '').trim() !== '');
    if (slot.name === 'header') this._hasHeader = filled;
    else if (slot.name === 'footer') this._hasFooter = filled;
    else this._updateEmpty();
  };

  override render() {
    return html`
      <div
        part="base"
        role="group"
        aria-label=${this.label || nothing}
      >
        <div
          part="header"
          ?hidden=${!this._hasHeader && !this.label}
        >
          <slot
            name="header"
            @slotchange=${this._onSlotChange}
          ></slot>
          <span
            part="label"
            ?hidden=${this._hasHeader}
            >${this.label}</span
          >
        </div>
        <div
          part="items"
          role="list"
          ?hidden=${this._empty}
        >
          <slot @slotchange=${this._onSlotChange}></slot>
        </div>
        <div
          part="placeholder"
          ?hidden=${!this._empty || this.disabled}
        >
          <slot name="empty">${this._localize.term('dropHere')}</slot>
        </div>
        <div
          part="footer"
          ?hidden=${!this._hasFooter}
        >
          <slot
            name="footer"
            @slotchange=${this._onSlotChange}
          ></slot>
        </div>
      </div>
    `;
  }
}
