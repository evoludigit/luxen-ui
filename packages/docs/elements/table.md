---
outline: deep
---

<script setup>
import basic from '../.vitepress/examples/table/Basic.html?raw'
import sizes from '../.vitepress/examples/table/Sizes.html?raw'
import striped from '../.vitepress/examples/table/Striped.html?raw'
import grid from '../.vitepress/examples/table/Grid.html?raw'
import sticky from '../.vitepress/examples/table/Sticky.html?raw'
import selection from '../.vitepress/examples/table/Selection.html?raw'
import rowLink from '../.vitepress/examples/table/RowLink.html?raw'
import footer from '../.vitepress/examples/table/Footer.html?raw'
import empty from '../.vitepress/examples/table/Empty.html?raw'
import selectableRows from '../.vitepress/examples/table/SelectableRows.html?raw'
import formSubmit from '../.vitepress/examples/table/FormSubmit.html?raw'
import navigableRows from '../.vitepress/examples/table/NavigableRows.html?raw'
</script>

# Table <Badge type="tip">&lt;table&gt;</Badge>

A data table on a native `<table>`, for lists of records.

<ElementSpec element="table" />

::: code-group

```html [HTML]
<table class="l-table">
  <caption>
    Products
  </caption>
  <thead>
    <tr>
      <th scope="col">SKU</th>
      <th
        scope="col"
        data-type="number"
      >
        In stock
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">SKU-1042</th>
      <td data-type="number">4,210</td>
    </tr>
  </tbody>
</table>
```

:::

A stylesheet, no JavaScript. The states it shows are the platform's: `aria-sort` for the sorted column, a checked checkbox for a selected row, a URL fragment for the row to jump to. The same markup works in a server-rendered page and in a framework template.

Wrap the table in `<l-data-table>` to add what HTML lacks: a reported sort; with `selectable`, a header checkbox, Shift ranges and a selection that outlives the page; column order and visibility; and with `navigable`, rows reached from the keyboard. It renders nothing else; the page keeps rendering the rows.

## Options

### Appearance

Pick a look with `data-appearance`. Each appearance has its own CSS import; the one imported is also the default.

#### Lines

Rules between rows only. The default.

<ComponentWrapper :html="basic" />

::: code-group

```css [CSS]
@import 'luxen-ui/css/table/lines';
```

<<< @/.vitepress/examples/table/Basic.html [HTML]

:::

#### Grid

Every cell drawn, an outer border and a filled header: for dense data read across rows and down columns.

<ComponentWrapper :html="grid" />

::: code-group

```css [CSS]
@import 'luxen-ui/css/table/grid';
```

<<< @/.vitepress/examples/table/Grid.html [HTML]

:::

### Basic

Add `class="l-table"` to a `<table>`. Name it with a `<caption>`, head each column with `<th scope="col">` and each row with the `<th scope="row">` that identifies it. Add `data-type="number"` to the cells of a numeric column, header included: it aligns to the inline end with tabular figures.

<ComponentWrapper :html="basic" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Basic.html [HTML]
:::

### Sizes

Add `data-size="sm"` or `data-size="lg"`. Rows follow the control size scale, so an `.l-button` of the same `data-size` fits a row. A row is a minimum height: content taller than it grows the row.

<ComponentWrapper :html="sizes" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Sizes.html [HTML]
:::

### Striped

Set `--stripe-color` to a tint, e.g. `var(--l-color-bg-state-hover)`: every other row takes it, in any appearance.

<ComponentWrapper :html="striped" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Striped.html [HTML]
:::

### Sticky header and columns

The header sticks to the top of the nearest scroll container. Put `data-sticky="end"` (or `start`) on every cell of a column to keep it at that edge while the table scrolls sideways; a shadow marks content scrolling under it. Cells wrap by default; add `white-space: nowrap` to the table (`whitespace-nowrap` in Tailwind) so it scrolls sideways instead. Set `--header-offset` when a fixed bar sits above the table.

<ComponentWrapper :html="sticky" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Sticky.html [HTML]
:::

### Sortable columns

Put a `<button>` in each sortable header, and `aria-sort="ascending"` or `"descending"` on the sorted one. When the server sorts, use a link to the sorted URL instead (`<a href="?sort=-sku">`): it takes the same look, and needs no script.

In script, wrap the table in `<l-data-table>` and give each sortable header a `data-key`: a click fires `sort-change` with the next sort (ascending, descending, then none). The element does not sort or touch `aria-sort`; the page sorts its rows and renders `aria-sort` from the event.

<TableSortDemo />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Sortable.html [HTML]
<<< @/.vitepress/components/TableSortDemo.vue [Vue]
:::

### Selectable rows

Put a native checkbox in a `data-select` cell at the start of each row, and name it with `aria-label`. The row is tinted while its checkbox is checked; inside a `<form>`, the checked rows submit their `value`s. Without script there is no select-all, so this example labels the column instead.

<ComponentWrapper :html="selection" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Selection.html [HTML]
:::

### Selection with `l-data-table`

Add `selectable` to `<l-data-table>` and leave the header's `data-select` cell empty: a header checkbox is added once the script runs, showing a mixed state while some rows are selected. Shift with a click or with Space selects a range. A selected row stays selected when it leaves the table, a filter or another page, and is checked again when it returns. Use radios instead of checkboxes to select one row at most.

The element fires `selection-change` with `rowSelection`, the inputs' `value`s mapped to `true`. Set `rowSelection` or call `clearSelection()` to drive it from the page; do not bind `checked` on the row inputs.

<ComponentWrapper :html="selectableRows" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/SelectableRows.html [HTML]
:::

### Keyboard navigation with `l-data-table`

Add `navigable` to `<l-data-table>` for lists people work through from the keyboard. It is off by default; without it the table behaves as it always does.

- **Tab.** The body is one tab stop: the row last reached, then that row's own controls. The other rows' controls leave the Tab sequence and come back when their row is reached, so don't bind `tabindex` on controls inside a navigable table's rows.
- **Moving.** ↑ and ↓ move between rows, Home and End go to the first and last, Page Up and Page Down move ten rows. A click on a plain cell makes its row the one the keyboard continues from.
- **Selecting**, with `selectable`. Space toggles the focused row, and Shift with Space gives every row from the last one toggled the same state. Shift with a move key selects from the row where the Shift run started to the focused row: moving back shrinks the run, and rows selected before it stay selected. Ctrl or Cmd with A selects every row on the page. Escape clears the whole selection, rows on other pages included; with radios it does nothing.
- **Opening.** Enter follows the row link. Ctrl or Cmd with Enter, and Shift with Enter, reach it as a click with the same modifier would, so a router or the browser can open the record in a new tab or window.
- **Re-rendering.** A row keeps its place by its input's `value`, else by its `id`: give rows without a selection input an `id` (the element warns otherwise). If the focused row is removed, focus moves to its neighbour.

Focus moves between rows, never cells: the rows keep the `row` role and the table keeps its caption and headers, and keys pressed on a control inside a row are left to that control. Screen readers keep their own table commands; in NVDA's and JAWS's browse mode the arrow keys stay the screen reader's.

<ComponentWrapper :html="navigableRows" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/NavigableRows.html [HTML]
:::

### Columns the user picks

Key every column with `data-key`; mark the ones that must stay with `data-fixed` and the ones hidden by default with `data-hidden`. Point an `<l-column-manager>` at the table's `id`: it lists the shown, hidden and fixed columns, with an eye button to show or hide, move buttons, Alt with ↑ or ↓, and drag and drop. The table hides columns itself; a new order arrives in `column-change` (`columnOrder`, `columnVisibility`) for the page to render. Add `persist-key` to keep the user's columns between visits, in `localStorage` under `l-data-table:` and the key (your own prefix if you renamed it), as `{ v: 1, columnOrder, columnVisibility }`. Restored columns, and those of a new `persist-key`, arrive once in `column-change`, so listen from the first load to render their order. The table hides a column by its position, so give the first column `data-fixed`: it carries the jump-to mark, and in the grid appearance the first and last cells carry the rounded corners. Rows with a spanning cell, such as an empty state, are left as they are.

<ColumnManagerDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/ColumnManagerDemo.vue [Vue]
:::

Place the manager where it fits, in an `l-popover` for instance:

```html
<button
  class="l-button"
  id="columns-trigger"
>
  Columns
</button>
<l-popover for="columns-trigger">
  <l-column-manager for="products"></l-column-manager>
</l-popover>
<l-data-table
  id="products"
  persist-key="products"
  >…</l-data-table
>
```

### Row link

Add `data-row-link` to the link in a row's header cell: a click anywhere in the row follows it, and it stays a real link — keyboard, middle-click, open in a new tab. The row's other controls and its selection cell stay clickable. Only a linked row is tinted under the pointer, since a hover tint promises a click.

Two trade-offs: text in a linked row cannot be selected with the mouse, and the row link must stay out of a `data-sticky` cell, which would confine it to that cell.

<ComponentWrapper :html="rowLink" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/RowLink.html [HTML]
:::

### Jump to a row

Give a row an `id` and link to it with a fragment (`#row-sku-1042`). The browser scrolls it into view below the sticky header, and the row is marked.

### Totals

Put totals in a `<tfoot>`. A single rule sets them apart from the rows. Several `<tbody>` elements group rows, each group closed by a rule.

<ComponentWrapper :html="footer" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Footer.html [HTML]
:::

### Empty

Render a single row whose cell spans every column.

<ComponentWrapper :html="empty" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/Empty.html [HTML]
:::

## Examples

### Loading from a server

Sort on the server: refetch on `sort-change`, set `aria-busy` while the request runs, and render placeholder rows with `l-skeleton` on the first load.

<DataTableServerDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/DataTableServerDemo.vue [Vue]
:::

### Bulk actions

Show the actions from `selection-change`, in a `role="status"` region so the count is announced. When every visible row is selected (`allPageRowsSelected`) and the query matches more, offer to select them all and set `allMatching`: the page then acts on the query rather than on the keys. The next change the user makes clears it.

<DataTableBulkDemo />

::: details Code
::: code-group
<<< @/.vitepress/components/DataTableBulkDemo.vue [Vue]
:::

### Inside a form

The checked rows submit their values with the form, with or without the script.

<ComponentWrapper :html="formSubmit" />

::: details Code
::: code-group
<<< @/.vitepress/examples/table/FormSubmit.html [HTML]
:::

### Listening to the events

The events carry TanStack Table's state shapes, and the matching properties take them: `sorting` (`[{ id, desc }]`, at most one entry), `rowSelection` (`{ [value]: true }`), `columnOrder` (keys in order) and `columnVisibility` (`{ [key]: boolean }`, a missing key is visible). A page already on TanStack Table passes them through as they are; any other maps them to its query in a line.

::: code-group

```html [Vue]
<l-data-table
  selectable
  @sort-change="sorting = $event.sorting"
  @selection-change="rowSelection = $event.rowSelection"
>
  <table class="l-table">
    …
  </table>
</l-data-table>
```

```jsx [React 19]
<l-data-table
  selectable
  onsort-change={(e) => setSorting(e.sorting)}
  onselection-change={(e) => setRowSelection(e.rowSelection)}
>
  <table className="l-table">…</table>
</l-data-table>
```

```js [JavaScript]
const table = document.querySelector('l-data-table');
table.addEventListener('sort-change', (e) => render({ sorting: e.sorting }));
table.addEventListener('selection-change', (e) => update(e.rowSelection));
```

:::

## Accessibility

### Criteria

<AccessibilityTable :data="[
  { Check: 'Table name', Description: 'A `<caption>` (visible or `.l-visually-hidden`) or `aria-label` names the table', WCAG: '[WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), [RGAA 5.4](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#5.4)' },
  { Check: 'Headers', Description: 'Column headers are `<th scope=&quot;col&quot;>` and each row has a `<th scope=&quot;row&quot;>`, so a screen reader announces the column and the record with every cell', WCAG: '[WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), [RGAA 5.6](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#5.6), [RGAA 5.7](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#5.7)' },
  { Check: 'Sort state', Description: '`aria-sort` on the sorted `<th>` is announced with the header; the control is a native `<button>`, as in the APG sortable table example', WCAG: '[WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
  { Check: 'Selection', Description: 'Selection is a native checkbox with its own name and checked state; no `aria-selected` is needed on the row', WCAG: '[WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 11.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#11.1)' },
  { Check: 'Row link', Description: 'The row link is a real `<a>`: listed among the page links, reachable by `Tab`, opened with `Enter`', WCAG: '[WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [WCAG 2.4.4](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context), [RGAA 6.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#6.1), [RGAA 7.3](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.3)' },
  { Check: 'Sort glyph', Description: 'The direction glyph of an unsorted column uses the tertiary text color, above 3:1 against the surface in both schemes', WCAG: '[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast), [RGAA 3.3](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#3.3)' },
  { Check: 'Header checkbox', Description: 'The checkbox `l-data-table` adds is named in the page language and reports a mixed state while some rows are selected; it exists only once the script runs, so there is never a control that does nothing', WCAG: '[WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
  { Check: 'Column manager', Description: 'Lists are named; every eye and move button is named after its column; moves have buttons besides drag and drop; changes are announced in a polite live region', WCAG: '[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1), [RGAA 7.5](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.5)' },
  { Check: 'Focus ring', Description: 'Header buttons, the row link and, with `navigable`, every visible cell of the focused row show the Luxen focus ring, also in forced colors, at 3:1 or more against the row; the focused row stays clear of the sticky header (2.4.11 is WCAG 2.2 only)', WCAG: '[WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast), [RGAA 10.7](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#10.7), [RGAA 3.3](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#3.3)' },
  { Check: 'Row navigation', Description: 'Opt-in with `navigable`; rows keep the `row` role and the table its semantics; the body is one tab stop; focus returns to a neighbour when the focused row is removed', WCAG: '[WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 7.3](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.3), [RGAA 12.8](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#12.8), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
]" :rules="[
  'Name the table with a `&lt;caption&gt;` or `aria-label`',
  'Use `&lt;th scope=&quot;col&quot;&gt;` for column headers and `&lt;th scope=&quot;row&quot;&gt;` for the cell that identifies each row',
  'Put the sort control in a `&lt;button&gt;` (or a link, when the server sorts) inside the header, and `aria-sort` on the sorted `&lt;th&gt;` only',
  'Name every row checkbox, e.g. `aria-label=&quot;Select SKU-1042&quot;`',
  'Keep `data-row-link` out of a `data-sticky` cell',
  'With `navigable`, don’t bind `tabindex` on controls inside the rows, and give rows without a selection input an `id`',
]" />

### Keyboard interactions

<KeyboardTable :data="[
  { Key: 'Tab', Description: 'Moves through the header controls, then each row’s checkbox, row link and actions' },
  { Key: 'Enter', Description: 'Activates the focused header button or follows the focused row link' },
  { Key: 'Space', Description: 'Activates the focused header button or toggles the focused checkbox' },
  { Key: 'Shift + Space', Description: 'With `l-data-table selectable`: gives every row from the last toggled one to the focused one the same state' },
  { Key: 'Shift + click', Description: 'Same, with the pointer' },
  { Key: 'Tab (into the body)', Description: 'With `l-data-table navigable`: enters on the row last reached, then that row’s controls, then leaves the table; Shift + Tab goes the other way' },
  { Key: '↑ / ↓', Description: 'With `navigable`, on a row: moves to the previous or next row' },
  { Key: 'Home / End', Description: 'With `navigable`: moves to the first or last row' },
  { Key: 'Page Up / Page Down', Description: 'With `navigable`: moves ten rows up or down' },
  { Key: 'Space (on a row)', Description: 'With `navigable`: toggles the row’s checkbox, or selects its radio' },
  { Key: 'Shift + Space (on a row)', Description: 'With `navigable selectable`: gives every row from the last one toggled to the focused one the same state' },
  { Key: 'Shift + ↑ / ↓ / Home / End / Page Up / Page Down', Description: 'With `navigable selectable`: moves and selects from the row where the Shift run started to the focused row; moving back shrinks the run, and rows selected before it stay selected' },
  { Key: 'Ctrl / Cmd + A (on a row)', Description: 'With `navigable selectable` and checkboxes: selects every row on the page' },
  { Key: 'Enter (on a row)', Description: 'With `navigable`: follows the row link' },
  { Key: 'Ctrl / Cmd / Shift + Enter (on a row)', Description: 'With `navigable`: follows the row link as a click with the same modifier would' },
  { Key: 'Escape (on a row)', Description: 'With `navigable selectable`: clears the whole selection (checkboxes), rows on other pages included' },
  { Key: 'Alt + ↑ / ↓', Description: 'In `l-column-manager`: moves the focused column up or down among the shown ones' },
]" />

## API reference

### Importing

::: code-group

```css [CSS]
@import 'luxen-ui/css/table/lines'; /* or table/grid */
@import 'luxen-ui/css/data-table';
@import 'luxen-ui/css/column-manager';
```

```js [JS]
import 'luxen-ui/data-table';
import 'luxen-ui/column-manager';
```

:::

The CSS covers the table itself; the JS import upgrades `l-data-table` with sorting, selection, columns and keyboard navigation. Selectable rows use `.l-checkbox` (`luxen-ui/css/checkbox`); row actions use `.l-button` (`luxen-ui/css/button`).

### Attributes

<ApiTable element="table" section="attributes" />

### CSS classes

<ApiTable element="table" section="cssClasses" />

### CSS custom properties

<ApiTable element="table" section="cssProperties" />

### Data table

<ApiTable element="data-table" section="properties" />

<ApiTable element="data-table" section="events" />

<ApiTable element="data-table" section="methods" />

### Column manager

<ApiTable element="column-manager" section="properties" />

<ApiTable element="column-manager" section="cssClasses" />
