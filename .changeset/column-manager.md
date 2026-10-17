---
'luxen-ui': minor
---

`<l-data-table>` now holds column order and visibility. Key the headers with `data-key`, mark columns that must stay with `data-fixed` and those hidden by default with `data-hidden`: the table hides columns with a stylesheet of its own and reports a new order in `column-change` for the page to render, never moving a cell. `columns` and `resetColumns()` let the page drive it, and `persist-key` keeps the user's columns in `localStorage`.

New `<l-column-manager for>`, the control for those columns: shown, hidden and fixed lists, an eye button to show or hide, move buttons so that reordering never depends on dragging, Alt with ↑ or ↓, drag and drop, a reset, and changes announced to assistive technology. Place it wherever it fits, an `l-popover` for instance.

Optional translation terms that are functions now type their arguments.
