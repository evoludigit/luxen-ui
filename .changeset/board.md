---
'luxen-ui': minor
---

New `<l-board>`, `<l-board-list>` and `<l-board-item>`: let the user move items between lists, by dragging a chip to another list or from its "Move to…" menu, which also works with a keyboard and on touch screens. The board never moves an item itself: it fires `move-request` with the item, its `value` and both lists, and your page moves the item in its own data, right away or after a confirmation of its own, or leaves it where it is. Moves that actually happen are announced to assistive technology. Lists take a `value`, and `board.state` reports the items' values by list, in the grouped shape of dnd-kit's `move()`: `move(state, event)` from `luxen-ui/board/state` applies a `move-request` to your own state, with no DOM, so it also runs in a store or on a server. Each list has `header` and `footer` slots, and shows a "Drop here" placeholder while empty, which an `empty` slot replaces with your own; a list's `canDrop(item, from)` decides which items it accepts, and items and lists can be `disabled`. An item's `actions` slot adds your own `l-dropdown-item`s to its menu, below the lists. Each menu is built as it opens, so a board of hundreds of items stays light. The opt-in `luxen-ui/css/board` stylesheet draws the board, its lists and its chips at their final sizes before the elements load, so the page does not shift when they do.

`l-dropdown`'s keyboard navigation now reaches items that a host element forwards into the menu through a `<slot>` of its own.

Optional translation terms that are functions now type their arguments.
