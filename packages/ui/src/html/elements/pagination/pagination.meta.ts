/*
 * Metadata sidecar for the pagination (CSS-only, styled via `.l-pagination` on a
 * native `<nav>`). The JSDoc below is the single source of truth for its
 * reference docs and the generated skill, read by the `native-meta` CEM plugin
 * and emitted into dist/metadata/pagination.json.
 *
 * Keep this in sync with src/css/elements/pagination.css.
 */

/**
 * @summary Links to the pages of a long list, the URL holding the page.
 *
 * @nativeElement nav
 * @selector .l-pagination
 *
 * @cssClass .l-pagination - Applied to the `<nav>`. Its optional first child is a `<p>` with the range shown; then an `<ol>` with one `<li>` per page link, step or gap.
 *
 * @attribute aria-label - Names the navigation landmark (use `"Pagination"`).
 * @attribute aria-current - Set to `page` on the current page's `<a>`.
 * @attribute data-step - previous | next — On the step links: draws a direction glyph, flipped in right-to-left pages. Leave out `href` when the step leads nowhere, which removes it from the tab order and greys it out; add `aria-disabled="true"` so assistive tech says so.
 *
 * @example Basic
 * <nav class="l-pagination" aria-label="Pagination">
 *   <p>51–100 of 1,284</p>
 *   <ol>
 *     <li><a href="?page=1" data-step="previous">Previous</a></li>
 *     <li><a href="?page=1">1</a></li>
 *     <li><a href="?page=2" aria-current="page">2</a></li>
 *     <li><a href="?page=3">3</a></li>
 *     <li aria-hidden="true">…</li>
 *     <li><a href="?page=26">26</a></li>
 *     <li><a href="?page=3" data-step="next">Next</a></li>
 *   </ol>
 * </nav>
 */
// JSDoc-only metadata carrier — the CEM analyzer reads the doc comment above; the
// class body is intentionally empty.
// oxlint-disable-next-line typescript/no-extraneous-class
export class PaginationMeta {}
