---
outline: deep
---

<script setup>
import boardSlots from '../.vitepress/examples/board/BoardSlots.html?raw'
import boardDisabled from '../.vitepress/examples/board/BoardDisabled.html?raw'
import boardStyled from '../.vitepress/examples/board/BoardStyled.html?raw'
import notDefinedCss from 'luxen-ui/css/board?raw'
</script>

# Board <Badge type="tip">&lt;l-board&gt;</Badge>

A board lets the user move items between lists, by drag and drop or from each item's "Move to…" menu. It never moves an item itself: it fires `move-request`, and the page moves the item in its own data.

::: code-group

```html [HTML]
<l-board label="Price tiers">
  <l-board-list
    label="Unpriced"
    value="unpriced"
  >
    <l-board-item value="sku-1042">Desk lamp</l-board-item>
  </l-board-list>
  <l-board-list
    label="Standard"
    value="standard"
  ></l-board-list>
</l-board>
```

```js [JS]
import { move } from 'luxen-ui/board/state';

let tiers = { unpriced: ['sku-1042'], standard: [] };

board.addEventListener('move-request', (event) => {
  tiers = move(tiers, event);
  render(tiers); // the page draws its items from its own data
});
```

:::

<ElementSpec element="board" />

## Options

### Moving items

The page owns the items. A drag to another list, or a choice in the "Move to…" menu, fires one `move-request` with `item`, its `value`, the `from` and `to` lists, and the positions `fromIndex` and `index`. Do nothing and the item stays put.

In a framework, change your data and let the framework render the item in its new list; never move the element yourself. `move()` from `luxen-ui/board/state` applies a request to the board's state shape: the item values of each list, keyed by the list's `value`. It returns a new object and leaves yours as it was. The module has no DOM and no dependency, so it runs in a store or on the server too.

```js
import { move } from 'luxen-ui/board/state';

move({ unpriced: ['sku-1042', 'sku-2210'], standard: [] }, event);
// → { unpriced: ['sku-2210'], standard: ['sku-1042'] }
```

The board gives the same shape back: `board.state` holds the item values of each list that has a `value`, as they are rendered.

Once an item with the requested `value` shows up in the requested list, the board announces the move to assistive technology. A request the page ignores, or a move the page makes on its own, announces nothing.

<BoardDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/BoardDemo.vue [BoardDemo.vue]
:::

#### Without a framework

On a page that renders nothing itself, move the element. `moveBefore()` keeps its state, focus included, where the browser has it:

```js
board.addEventListener('move-request', ({ item, to }) => {
  to.moveBefore?.(item, null) ?? to.append(item);
});
```

### Confirming a move

The request is not cancelable, because it has no default to cancel: apply it whenever you are ready, after your own dialog or a save. The board keeps the request for 10 seconds, and announces the move if it lands by then.

```vue
<script setup>
import { ref } from 'vue';
import { move } from 'luxen-ui/board/state';

const tiers = ref({ unpriced: ['sku-1042'], standard: [] });

async function onMoveRequest(event) {
  if (!(await confirmMove(event.value, event.to.value))) return;
  await saveTier(event.value, event.to.value);
  tiers.value = move(tiers.value, event);
}
</script>

<template>
  <l-board
    label="Price tiers"
    @move-request="onMoveRequest"
  >
    …
  </l-board>
</template>
```

### Header and footer

Each list shows its `label` as a heading. Fill the `header` slot to show your own content instead; `label` still names the list. Put controls for adding items in the `footer` slot.

<ComponentWrapper vertical :html="boardSlots" />

::: details Code
::: code-group
<<< @/.vitepress/examples/board/BoardSlots.html [HTML]
:::

### Drop rules

`canDrop` decides which items a list accepts: a function of the item and the list it comes from. The board asks it on every drag over the list and each time a menu opens, and leaves a list that refuses out of the menu. Set it as a property.

```js
// Three items at most.
list.canDrop = () => list.items.length < 3;
```

An empty list shows a "Drop here" placeholder, which takes drops too. Fill the `empty` slot to say something of your own.

<BoardCanDropDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/BoardCanDropDemo.vue [BoardCanDropDemo.vue]
:::

### Item actions

Put `l-dropdown-item`s in an item's `actions` slot to add your own entries to its menu, below the lists. Choosing one fires `select` on the item, with the chosen entry as `event.item`, and no `move-request`.

```html
<l-board-item value="msg-1">
  Quarterly report
  <l-dropdown-item
    slot="actions"
    value="delete"
    >Delete</l-dropdown-item
  >
</l-board-item>
```

<BoardActionsDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/BoardActionsDemo.vue [BoardActionsDemo.vue]
:::

### Disabled

Add `disabled` to an item to keep it in place, or to a list so that it accepts no item. A disabled list shows no placeholder and is left out of the menus; its own items can still leave.

<ComponentWrapper vertical :html="boardDisabled" />

::: details Code
::: code-group
<<< @/.vitepress/examples/board/BoardDisabled.html [HTML]
:::

### Not defined

Before the elements upgrade (`:not(:defined)`), the opt-in `luxen-ui/css/board` sheet draws the board's grid, its lists and its chips at the sizes they take once defined, so the page does not shift when the script loads. The lists show their `label`, and an empty list its placeholder box. It reads the same hooks as the elements; override the shipped `:not(:defined)` rules to change it.

<NotDefinedPreview :css="notDefinedCss" :height="200" html='<l-board label="Price tiers" style="inline-size:34rem"><l-board-list label="Unpriced"><l-board-item value="sku-1042">Desk lamp</l-board-item><l-board-item value="sku-2210">Office chair</l-board-item></l-board-list><l-board-list label="Standard"></l-board-list></l-board>' />

## Examples

### Kanban

`::part(items)` stacks the chips top to bottom, and the `header` slot holds a count badge. Vue's `TransitionGroup` can wrap the items: the list finds them inside wrappers too.

```css
l-board-list::part(items) {
  flex-direction: column;
  align-items: flex-start;
}
```

<BoardKanbanDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/BoardKanbanDemo.vue [BoardKanbanDemo.vue]
:::

### Styling

The board, the lists and the items each take a few custom properties, and expose their boxes as parts. Here the lists lose their border, the labels turn into small capitals, and a disabled list is dashed and unfilled instead of greyed.

<ComponentWrapper vertical :html="boardStyled" />

::: details Code
::: code-group
<<< @/.vitepress/examples/board/BoardStyled.html [HTML]
:::

## Using with Vue

- Keep the board's state in a `ref` and apply each request with `move()`, as in the examples above. Vue then renders the item in its new list, and the board announces it.
- Key each item by its `value`: Vue keeps the element of an item that stays, and the board finds a moved one by its value.
- Tell Vue that `l-` tags are custom elements, so it does not try to resolve them as components:

  ```js
  // vite.config.js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('l-') } } });
  ```

- Vue sets a property only when the element already has it, so define the elements before the app mounts (`await import('luxen-ui/board')` and so on). Or bind with `.prop`, which sets the property in any case: `:canDrop.prop="rule"`, `:disabled.prop="locked"`.
- `TransitionGroup` with `tag="div" class="contents"` animates the items that land, as in the [kanban](#kanban). End its leave at once with `@leave="(el, done) => done()"`: otherwise Vue keeps the item that left in its old list for at least a frame, and the board sees two items with one `value`.

## Accessibility

### Criteria

<AccessibilityTable :data="[
  { Check: 'Role', Description: 'The board and each list are groups named by their `label`; the items of a list are `listitem`s of a `list`', WCAG: '[WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
  { Check: 'Dragging alternative', Description: 'Every item has a &quot;Move to…&quot; menu button, named after the item, that lists the lists it can go to', WCAG: '[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
  { Check: 'Target size', Description: 'The &quot;Move to…&quot; button is 24px tall and wide', WCAG: '[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [RGAA 13.10](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#13.10)' },
  { Check: 'Status messages', Description: 'A move the page has applied is announced with `ariaNotify()`, or in a polite live region where the browser lacks it', WCAG: '[WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [RGAA 7.5](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.5)' },
  { Check: 'Focus management', Description: 'After a move chosen from the menu, focus returns to the moved item’s button in its new list', WCAG: '[WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [RGAA 12.8](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#12.8)' },
  { Check: 'Forced colors', Description: 'The drop target takes the `Highlight` color, and a disabled list a dashed `GrayText` border', WCAG: '[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)' },
  { Check: 'Motion', Description: 'Drop-target and menu transitions respect `prefers-reduced-motion`', WCAG: '[WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)' },
]" :rules="[
  'Give the board and every list a `label`: it names them for screen readers and in the menus',
  'Give every item a unique `value`, and keep it when you render the item in its new list, so the board can announce the move',
  'When you refuse a move, tell the user why: the board only announces the moves that happen',
]" />

### Keyboard interactions

<KeyboardTable :data="[
  { Key: 'Tab', Description: 'Moves focus to the next item’s &quot;Move to…&quot; button' },
  { Key: 'Enter', Description: 'Opens the menu on the first list, or chooses the focused entry: a move request, or one of the item’s actions' },
  { Key: 'Space', Description: 'Opens the menu on the first list, or chooses the focused entry: a move request, or one of the item’s actions' },
  { Key: 'ArrowDown', Description: 'Opens the menu, or moves to the next entry in it' },
  { Key: 'ArrowUp', Description: 'Opens the menu on the last entry, or moves to the previous entry in it' },
  { Key: 'Escape', Description: 'Closes the menu and returns focus to its button' },
]" />

### Selectors & testing

Each item's button is named after it, and each menu entry after its list, so tests can drive a move as a user would. While a drag is on, the carried item has `data-dragging` and the list under the pointer `data-drop-target`.

```js
await page.getByRole('button', { name: 'Move Desk lamp to…' }).click();
await page.getByRole('menuitem', { name: 'Standard' }).click();
await expect(page.getByRole('group', { name: 'Standard' })).toContainText('Desk lamp');
```

```css
/* While an item is carried, and over the list it would land in. */
l-board-item[data-dragging]::part(tag) {
  outline: 2px dashed var(--l-color-border);
}

l-board-list[data-drop-target]::part(label) {
  text-decoration: underline;
}
```

## API reference

### Importing

::: code-group

```js [JS]
import 'luxen-ui/board';
import 'luxen-ui/board-list';
import 'luxen-ui/board-item';
import { move } from 'luxen-ui/board/state';
```

```css [CSS]
/* Optional: the board's look before its elements load. */
@import 'luxen-ui/css/board';
```

:::

### Attributes & Properties

<ApiTable element="board" section="properties" />

#### `<l-board-list>`

<ApiTable element="board-list" section="properties" />

<ApiTable element="board-list" section="attributes" />

#### `<l-board-item>`

<ApiTable element="board-item" section="properties" />

<ApiTable element="board-item" section="attributes" />

### Methods

#### `<l-board-list>`

<ApiTable element="board-list" section="methods" />

#### `<l-board-item>`

<ApiTable element="board-item" section="methods" />

### Events

<ApiTable element="board" section="events" />

#### `<l-board-item>`

<ApiTable element="board-item" section="events" />

### Slots

<ApiTable element="board" section="slots" />

#### `<l-board-list>`

<ApiTable element="board-list" section="slots" />

#### `<l-board-item>`

<ApiTable element="board-item" section="slots" />

### CSS parts

<ApiTable element="board" section="cssParts" />

#### `<l-board-list>`

<ApiTable element="board-list" section="cssParts" />

#### `<l-board-item>`

<ApiTable element="board-item" section="cssParts" />

### CSS custom properties

<ApiTable element="board" section="cssProperties" />

#### `<l-board-list>`

<ApiTable element="board-list" section="cssProperties" />

#### `<l-board-item>`

<ApiTable element="board-item" section="cssProperties" />
