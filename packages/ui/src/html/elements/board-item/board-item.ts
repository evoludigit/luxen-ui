import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { html as staticHtml } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { tagName } from '../../registry.js';
import { staticTag } from '../../static-tag.js';
import { DropdownSelectEvent, type Dropdown } from '../dropdown/dropdown.js';
import type { BoardList } from '../board-list/board-list.js';
import hostStyles from '../../shared/styles/host.styles.js';
import rawStyles from './board-item.css?inline';
import '../tag/index.js';
import '../dropdown/index.js';
import '../dropdown-item/index.js';

const styles = unsafeCSS(rawStyles);

/**
 * Internal contract between an `l-board-item` and its `l-board`, the way
 * `l-tree-item` talks to `l-tree`: the user chose a list in the item's menu.
 * The board turns it into the public `move-request`.
 */
export class BoardItemMoveEvent extends Event {
  readonly to: BoardList;
  constructor(to: BoardList) {
    super('board-item-move', { bubbles: true, composed: false, cancelable: false });
    this.to = to;
  }
}

/**
 * One movable item of an `l-board-list`, drawn as an `l-tag` chip.
 *
 * The chip can be dragged to another list of its `l-board`, and carries a
 * "Move to…" menu button listing the board's other enabled lists, so a move
 * never depends on dragging (WCAG 2.2 SC 2.5.7). Either way the item only
 * requests the move: see `l-board`.
 *
 * @summary A movable chip in an `l-board-list`.
 *
 * @example
 * ```html
 * <l-board-item value="sku-1042">Desk lamp</l-board-item>
 * ```
 *
 * @slot - The item's label. Its text names the item in the menu and in announcements, unless `label` is set.
 * @slot actions - `l-dropdown-item`s of the page's own, shown in the menu below the lists. Choosing one fires `select` on the item, and no `move-request`.
 *
 * @csspart tag - The `l-tag` chip.
 * @csspart trigger - The "Move to…" button at the end of the chip.
 *
 * @cssproperty [--text-color] - Label color, passed to the chip.
 * @cssproperty [--background-color] - Chip fill, passed to the chip.
 * @cssproperty [--border-color] - Chip border, and the rule that splits off the "Move to…" button.
 * @cssproperty [--show-duration] - Show animation of the "Move to…" menu, in ms. Inherited, so it can be set on the board. Default `150`.
 * @cssproperty [--hide-duration] - Hide animation of the "Move to…" menu, in ms. Inherited, so it can be set on the board. Default `150`.
 *
 * @event select - Fired when the user chooses one of the page's `actions` in the menu. Not cancelable. Bubbles. Properties: `item: DropdownItem`.
 *
 * @attribute data-dragging - Set while the item is being dragged.
 *
 * @customElement l-board-item
 */
export class BoardItem extends LuxenElement {
  static override styles = [hostStyles, styles];

  private _localize = new LocalizeController(this);
  private _internals = this.attachInternals();
  private _targets: BoardList[] = [];

  /** Required, unique within the board. Identifies the item in `move-request`, and across lists once the page has moved it. */
  @property({ reflect: true })
  accessor value = '';

  /** Names the item in the menu and in announcements. Defaults to its text. */
  @property({ reflect: true })
  accessor label = '';

  /** Keeps the item where it is: it cannot be dragged and its menu is disabled. */
  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  override connectedCallback() {
    super.connectedCallback();
    this._internals.role = 'listitem';
    // Mirrored as an attribute so `[role]` selectors and tools that read the
    // DOM see it too. An author-provided role wins.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
    // A page that moves the item re-parents it: the lists it can go to change.
    this.requestUpdate();
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('disabled')) this.draggable = !this.disabled;
  }

  /** The list the item is in. */
  get list(): BoardList | null {
    return this.parentElement?.closest<BoardList>(tagName('board-list')) ?? null;
  }

  /** The label used in the menu and in announcements: `label`, or the item's text, its `actions` left out. */
  getTextLabel(): string {
    if (this.label) return this.label;
    const text = [...this.childNodes]
      .filter((node) => !(node instanceof Element && node.hasAttribute('slot')))
      .map((node) => node.textContent)
      .join('');
    return text.trim();
  }

  /** Focuses the "Move to…" button. */
  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus(options);
  }

  /**
   * The board's other lists that accept this item. A list not upgraded yet is
   * read from its attributes, so this holds whatever order the elements
   * upgrade in.
   */
  private _findTargets(): BoardList[] {
    const list = this.list;
    const board = this.closest(tagName('board'));
    if (!board) return [];
    return [...board.querySelectorAll<BoardList>(tagName('board-list'))].filter(
      (l) =>
        l.closest(tagName('board')) === board &&
        (l.matches(':defined') ? l.accepts(this) : l !== list && !l.hasAttribute('disabled')),
    );
  }

  /**
   * The menu's entries exist only while it is open, so a board of many items
   * renders none until one is asked for. Built again on each opening, since
   * `canDrop` may read data that changed since.
   */
  @state() private accessor _menuOpen = false;

  private _onShow = () => {
    this._menuOpen = true;
    this.requestUpdate();
  };

  private _onAfterHide = (e: Event) => {
    // A menu reopened during its hide animation keeps its entries.
    if (!(e.currentTarget as Dropdown).open) this._menuOpen = false;
  };

  private _onSelect = (e: DropdownSelectEvent) => {
    const index = e.item.dataset.listIndex;
    const to = index === undefined ? undefined : this._targets[Number(index)];
    if (to) this.dispatchEvent(new BoardItemMoveEvent(to));
    // One of the page's `actions`: the dropdown's event stops at this shadow
    // root, so it is fired again on the item, where the page listens.
    else this.dispatchEvent(new DropdownSelectEvent(e.item));
  };

  override render() {
    this._targets = this._findTargets();
    const movable = !this.disabled && this._targets.length > 0;
    const tag = staticTag('tag');
    const dropdown = staticTag('dropdown');
    const item = staticTag('dropdown-item');
    // The menu opens from inside a draggable chip: `draggable="false"` keeps a
    // press on the button or a menu item from starting a drag of the chip.
    return staticHtml`
      <${tag} class="tag" part="tag" ?disabled=${this.disabled}>
        <slot></slot>
        <${dropdown}
          slot="suffix"
          class="menu"
          placement="bottom-end"
          draggable="false"
          ?disabled=${!movable}
          @show=${this._onShow}
          @after-hide=${this._onAfterHide}
          @select=${this._onSelect}
        >
          <button
            slot="trigger"
            type="button"
            class="trigger"
            part="trigger"
            aria-label=${this._localize.term('moveItemTo', this.getTextLabel())}
            ?disabled=${!movable}
          ></button>
          ${
            this._menuOpen
              ? staticHtml`
                ${this._targets.map(
                  (list, i) =>
                    staticHtml`<${item} data-list-index=${String(i)}>${list.getAttribute('label') ?? nothing}</${item}>`,
                )}
                ${this.querySelector(':scope > [slot="actions"]') ? html`<hr />` : nothing}
                <slot name="actions"></slot>
              `
              : nothing
          }
        </${dropdown}>
      </${tag}>
    `;
  }
}
