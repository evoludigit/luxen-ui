---
'luxen-ui': minor
---

New `<l-data-table>`, wrapped around a `.l-table` to add what HTML lacks, documented on the table page. Give sortable headers a `data-key`: activating one fires `sort-change` with the next sort, and the page sorts its rows and renders `aria-sort` from it. Add `selectable` and leave the header's `data-select` cell empty: a header checkbox appears once the script runs, with a mixed state, Shift with a click or with Space selects a range, and a selected row stays selected while it is off the table. `selection-change` reports the selected values; `rowSelection`, `allMatching` and `clearSelection()` let the page drive it. The sort and the selection travel in TanStack Table's state shapes (`SortingState`, `RowSelectionState`), without depending on it. The element renders nothing else, so the page keeps rendering every row.
