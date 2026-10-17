---
'luxen-ui': minor
---

New `.l-pagination`, links to the pages of a long list on a native `<nav>`. Put the range shown in a `<p>`, then one link per page in an `<ol>`; mark the current page with `aria-current="page"`, the previous and next links with `data-step`, and a gap with `<li aria-hidden="true">`. A step that leads nowhere is a link without `href`, which the browser already keeps out of the tab order. There is no JavaScript: the URL holds the page, so it works with a server and with any router's link component.
