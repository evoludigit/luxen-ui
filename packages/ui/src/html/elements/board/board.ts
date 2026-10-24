import { html, nothing, unsafeCSS } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LuxenElement } from '../../shared/luxen-element.js';
import { LocalizeController } from '../../shared/localize.js';
import { tagName } from '../../registry.js';
import type { BoardItem, BoardItemMoveEvent } from '../board-item/board-item.js';
import type { BoardList } from '../board-list/board-list.js';
import type { BoardMove, BoardState } from './board-state.js';
import hostStyles from '../../shared/styles/host.styles.js';
import rawStyles from './board.css?inline';

const styles = unsafeCSS(rawStyles);

/** How long a request waits for the page to apply it, in ms. */
const PENDING_TTL = 10_000;

interface PendingMove {
  value: string;
  from: BoardList;
  to: BoardList;
  focus: boolean;
  at: number;
}

export interface MoveRequestInit {
  readonly item: BoardItem;
  readonly from: BoardList;
  readonly to: BoardList;
  readonly fromIndex: number;
  readonly index: number;
}

/**
 * Fired when the user asks to move an item to another list, by dragging it or
 * from its "Move to…" menu. The board moves nothing: the page moves the item
 * in its own data, now or after its own confirmation, or ignores the request.
 * It is a `BoardMove`, so `move(state, event)` from `luxen-ui/board/state`
 * applies it. Bubbles; not composed.
 */
export class MoveRequestEvent extends Event implements BoardMove {
  readonly item: BoardItem;
  readonly value: string;
  readonly from: BoardList;
  readonly to: BoardList;
  /** The item's position in `from`. */
  readonly fromIndex: number;
  /** The item's final position in `to`. Items are appended: `to.items.length`. */
  readonly index: number;
  constructor({ item, from, to, fromIndex, index }: MoveRequestInit) {
    super('move-request', { bubbles: true, composed: false, cancelable: false });
    this.item = item;
    this.value = item.value;
    this.from = from;
    this.to = to;
    this.fromIndex = fromIndex;
    this.index = index;
  }
}

declare global {
  interface GlobalEventHandlersEventMap {
    'move-request': MoveRequestEvent;
  }
}

/**
 * Lets the user move items between lists: `l-board-list`s of `l-board-item`s.
 *
 * An item is dragged to another list, or sent there from its "Move to…"
 * menu, so a move never depends on dragging (WCAG 2.2 SC 2.5.7). Either way
 * the board only fires `move-request`: the page owns the items and moves them,
 * maybe after a dialog of its own, or not at all. The board watches its lists
 * and announces, in a polite live region, the user's latest request once the
 * item shows up in the list it asked for. A request the page ignores, or a
 * move the page makes on its own, announces nothing.
 *
 * @summary Moves items between lists, by drag and drop or from a menu, and lets the page apply each move.
 *
 * @example
 * ```html
 * <l-board label="Price tiers">
 *   <l-board-list label="Unpriced">
 *     <l-board-item value="sku-1042">Desk lamp</l-board-item>
 *   </l-board-list>
 *   <l-board-list label="Standard"></l-board-list>
 * </l-board>
 * <script>
 *   board.addEventListener('move-request', (e) => e.to.append(e.item));
 * </script>
 * ```
 *
 * @slot - The `l-board-list`s.
 *
 * @csspart base - The grid of lists.
 *
 * @cssproperty [--gap=1rem] - Space between the lists.
 * @cssproperty [--list-width=16rem] - Narrowest a list gets before the grid wraps to a new row.
 *
 * @event move-request - Fired when the user asks to move an item to another list. Not cancelable. Bubbles. Properties: `item: BoardItem`, `value: string` (the item's), `from: BoardList`, `to: BoardList`, `fromIndex: number` (the item's position in `from`), `index: number` (its final position in `to`: `to.items.length`, items are appended). A `BoardMove`: `move(state, event)` applies it.
 *
 * @customElement l-board
 */
export class Board extends LuxenElement {
  static override styles = [hostStyles, styles];

  private _localize = new LocalizeController(this);

  /** Names the board as a group. */
  @property({ reflect: true })
  accessor label = '';

  @state() private accessor _announcement = '';

  private _observer: MutationObserver | null = null;
  private _announceFrame = 0;
  private _pending: PendingMove | null = null;
  /** Items already warned about, so each warning shows once. */
  private _warned = new WeakSet<Element>();
  private _dragged: BoardItem | null = null;
  private _dropTarget: BoardList | null = null;

  /** The board's lists, in document order. Like `items`, only the upgraded ones. */
  get lists(): BoardList[] {
    const board = tagName('board');
    return [...this.querySelectorAll<BoardList>(tagName('board-list'))].filter(
      (list) => list.matches(':defined') && list.closest(board) === this,
    );
  }

  /**
   * The item values of each list, keyed by list `value`, in document order;
   * lists without a value are left out. Read-only and derived from the
   * children every time, never a second source of truth: the page renders
   * its own state, and `move(state, event)` applies a `move-request` to it.
   */
  get state(): BoardState {
    return Object.fromEntries(
      this.lists
        .filter((list) => list.value)
        .map((list) => [list.value, list.items.map((i) => i.value)]),
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('board-item-move', this._onItemMove as EventListener);
    this.addEventListener('board-list-change', this._refreshItems);
    this.addEventListener('dragstart', this._onDragStart);
    this.addEventListener('dragover', this._onDragOver);
    this.addEventListener('dragleave', this._onDragLeave);
    this.addEventListener('drop', this._onDrop);
    this.addEventListener('dragend', this._endDrag);
    // `label` and `disabled` change what the menus offer; `value` and the
    // children say where each item is; an item's text names its button.
    this._observer = new MutationObserver(this._sync);
    this._observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['label', 'disabled', 'value'],
    });
  }

  override firstUpdated() {
    this._checkValues();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('board-item-move', this._onItemMove as EventListener);
    this.removeEventListener('board-list-change', this._refreshItems);
    this.removeEventListener('dragstart', this._onDragStart);
    this.removeEventListener('dragover', this._onDragOver);
    this.removeEventListener('dragleave', this._onDragLeave);
    this.removeEventListener('drop', this._onDrop);
    this.removeEventListener('dragend', this._endDrag);
    this._observer?.disconnect();
    this._observer = null;
    cancelAnimationFrame(this._announceFrame);
    this._endDrag();
  }

  // --- Requests and the moves that follow ---

  /**
   * The board waits on one request at a time: the user's latest. It ends when
   * the item leaves the list it was asked from, when the user asks for another
   * move, or after `PENDING_TTL`. Only an item that lands in the requested list
   * is announced, so a move the page makes for its own reason, an earlier
   * request included, announces nothing and leaves focus alone.
   */
  private _request(item: BoardItem, to: BoardList, focus: boolean) {
    const from = item.list;
    if (!from || from === to) return;
    // Without a value, the item cannot be told from another one in the page's
    // render, so its move is neither announced nor followed by focus.
    this._pending = item.value
      ? { value: item.value, from, to, focus, at: performance.now() }
      : null;
    item.dispatchEvent(
      new MoveRequestEvent({
        item,
        from,
        to,
        fromIndex: from.items.indexOf(item),
        index: to.items.length,
      }),
    );
  }

  private _onItemMove = (e: BoardItemMoveEvent) => {
    const item = e.target as BoardItem;
    if (item.closest(tagName('board')) === this) this._request(item, e.to, true);
  };

  /** Re-renders every item: what a list accepts changed (`canDrop`). */
  private _refreshItems = () => {
    for (const list of this.lists) for (const item of list.items) item.requestUpdate();
  };

  /** Runs after the page changed the board. */
  private _sync = (all: MutationRecord[]) => {
    const records = all.filter(this._relevant);
    if (!records.length) return;
    // A text edit only renames the item it is in.
    if (records.every((r) => r.type === 'characterData')) {
      const tag = tagName('board-item');
      for (const r of records) r.target.parentElement?.closest<BoardItem>(tag)?.requestUpdate();
      return;
    }
    const lists = this.lists;
    for (const list of lists) list._updateEmpty();
    const items = lists.flatMap((list) => list.items);
    // An item renders its own changes, and re-renders when it moves. Only a
    // list added, removed or changed (`label`, `disabled`) changes the others:
    // their "Move to…" button, and an open menu's entries.
    if (records.some(this._touchesLists)) for (const item of items) item.requestUpdate();
    this._checkValues();
    this._settle(items);
  };

  /**
   * Whether a change is the board's business: a list or an item of this board
   * added, removed or changed, or text inside an item. Content the page puts
   * in a list's header or footer, or in another board, is not.
   */
  private _relevant = (record: MutationRecord) => {
    const list = tagName('board-list');
    const item = tagName('board-item');
    const target =
      record.type === 'characterData' ? record.target.parentElement : (record.target as Element);
    if (!target || target.closest(tagName('board')) !== this) return false;
    if (record.type === 'characterData') return !!target.closest(item);
    if (record.type === 'attributes') return target.localName === list || target.localName === item;
    const ours = (node: Node) =>
      node instanceof Element &&
      (node.localName === list ||
        node.localName === item ||
        !!node.querySelector(`${list}, ${item}`));
    return [...record.addedNodes, ...record.removedNodes].some(ours);
  };

  private _touchesLists = (record: MutationRecord) => {
    const tag = tagName('board-list');
    const isList = (node: Node) =>
      node instanceof Element && (node.localName === tag || !!node.querySelector(tag));
    if (record.type === 'attributes') return (record.target as Element).localName === tag;
    return [...record.addedNodes, ...record.removedNodes].some(isList);
  };

  /**
   * Ends the pending request once its item has left the list it was asked
   * from: an item with its value is in another list, the same element
   * re-parented or a new one a framework rendered there. Announced, and
   * followed by focus, only if that list is the requested one.
   */
  private _settle(items: BoardItem[]) {
    const pending = this._pending;
    if (!pending) return;
    if (performance.now() - pending.at > PENDING_TTL) {
      this._pending = null;
      return;
    }
    const item = items.find((i) => i.value === pending.value && i.list !== pending.from);
    if (!item) return;
    this._pending = null;
    if (item.list !== pending.to) return;
    this._announce(this._localize.term('itemMoved', item.getTextLabel(), pending.to.label));
    if (pending.focus) void this._refocus(item);
  }

  /**
   * Warns once per item about a missing or duplicate `value`, which the board
   * needs to recognise an item once the page has moved it. Read from the
   * property once the item has upgraded (a framework may set only that), and
   * from the attribute before.
   */
  private _checkValues() {
    const board = tagName('board');
    const seen = new Set<string>();
    for (const item of this.querySelectorAll<BoardItem>(tagName('board-item'))) {
      if (item.closest(board) !== this) continue;
      const value = item.matches(':defined') ? item.value : (item.getAttribute('value') ?? '');
      let problem = '';
      if (!value) problem = 'has no value';
      else if (seen.has(value)) problem = `has the value "${value}" of another item`;
      seen.add(value);
      if (!problem || this._warned.has(item)) continue;
      this._warned.add(item);
      const name = item.matches(':defined')
        ? item.getTextLabel()
        : item.getAttribute('label') || (item.textContent ?? '').trim();
      // eslint-disable-next-line no-console
      console.warn(
        `<${this.localName}>: <${item.localName}> "${name}" ${problem}. Give each item a ` +
          `value unique within the board, or its moves cannot be announced.`,
      );
    }
  }

  /**
   * After a move chosen from the menu, the button that had focus left with the
   * item, or was removed with it: put focus back on the item, unless the user
   * or the page has taken focus out of the board since (a dialog, say).
   */
  private async _refocus(item: BoardItem) {
    await item.updateComplete;
    const active = document.activeElement;
    if (!active || active === document.body || this.contains(active)) item.focus();
  }

  /**
   * Speaks `message` politely. `ariaNotify()` is Baseline newly available
   * (https://webstatus.dev/features/arianotify) and needs no region; elsewhere
   * the live region is cleared, then filled two frames later, so a screen
   * reader neither coalesces the two nor drops a repeat of the same message.
   * A helper shared with `l-tree-item` and others would be a separate change.
   */
  private _announce(message: string) {
    const notifier = this as this & { ariaNotify?: (message: string) => void };
    if (typeof notifier.ariaNotify === 'function') {
      notifier.ariaNotify(message);
      return;
    }
    this._announcement = '';
    cancelAnimationFrame(this._announceFrame);
    this._announceFrame = requestAnimationFrame(() => {
      this._announceFrame = requestAnimationFrame(() => {
        this._announcement = message;
      });
    });
  }

  // --- Drag and drop ---

  private _listFromEvent(e: Event): BoardList | null {
    const tag = tagName('board-list');
    const board = tagName('board');
    for (const node of e.composedPath()) {
      if (node instanceof Element && node.localName === tag) {
        return node.closest(board) === this ? (node as BoardList) : null;
      }
    }
    return null;
  }

  /** Where the dragged item may be dropped: another list of this board that accepts items. */
  private _acceptingList(e: Event): BoardList | null {
    const list = this._listFromEvent(e);
    return this._dragged && list?.accepts(this._dragged) ? list : null;
  }

  private _setDropTarget(list: BoardList | null) {
    if (list === this._dropTarget) return;
    if (this._dropTarget) delete this._dropTarget.dataset.dropTarget;
    this._dropTarget = list;
    if (list) list.dataset.dropTarget = '';
  }

  private _onDragStart = (e: DragEvent) => {
    const item = (e.target as Element).closest?.<BoardItem>(tagName('board-item'));
    if (!item || item.disabled || item.closest(tagName('board')) !== this) return;
    this._endDrag();
    this._dragged = item;
    item.dataset.dragging = '';
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox only starts a drag that carries data. A type of our own, not
      // `text/plain`, so a chip dropped in a text field inserts nothing.
      e.dataTransfer.setData('application/x-luxen-board-item', item.value);
    }
  };

  private _onDragOver = (e: DragEvent) => {
    const list = this._acceptingList(e);
    this._setDropTarget(list);
    if (!list) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  private _onDragLeave = (e: DragEvent) => {
    const to = e.relatedTarget as Node | null;
    if (!to || !this.contains(to)) this._setDropTarget(null);
  };

  private _onDrop = (e: DragEvent) => {
    const item = this._dragged;
    const list = this._acceptingList(e);
    this._endDrag();
    if (!item || !list) return;
    e.preventDefault();
    this._request(item, list, false);
  };

  private _endDrag = () => {
    if (this._dragged) delete this._dragged.dataset.dragging;
    this._dragged = null;
    this._setDropTarget(null);
  };

  override render() {
    return html`
      <div
        part="base"
        role="group"
        aria-label=${this.label || nothing}
      >
        <slot></slot>
      </div>
      <div
        class="announcer"
        role="status"
        aria-atomic="true"
      >
        ${this._announcement}
      </div>
    `;
  }
}
