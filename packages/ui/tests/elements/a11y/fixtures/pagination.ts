import { defineA11yFixture } from '../../support/a11y-fixture.js';

// .l-pagination is CSS only, on a native <nav>. The a11y-critical surfaces are the
// landmark name, `aria-current="page"`, the gap marker staying out of the
// accessibility tree, a step without href reading as disabled, and contrast of
// the range text, the current page and the disabled step against the surface.
const NAV = (previous: string) => `
  <nav class="l-pagination" aria-label="Pagination">
    <p>51–100 of 1,284</p>
    <ol>
      <li>${previous}</li>
      <li><a href="#page-1">1</a></li>
      <li><a href="#page-2" aria-current="page">2</a></li>
      <li><a href="#page-3">3</a></li>
      <li aria-hidden="true">…</li>
      <li><a href="#page-26">26</a></li>
      <li><a href="#page-3" data-step="next">Next</a></li>
    </ol>
  </nav>`;

export default defineA11yFixture({
  name: 'pagination',
  states: {
    default: NAV('<a href="#page-1" data-step="previous">Previous</a>'),
    firstPage: NAV('<a data-step="previous" aria-disabled="true">Previous</a>'),
  },
});
