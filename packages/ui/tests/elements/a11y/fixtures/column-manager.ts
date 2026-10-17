import { defineA11yFixture } from '../../support/a11y-fixture.js';

// <l-column-manager> builds its own lists and buttons. The a11y-critical
// surfaces are the lists' names, every control named after its column, the
// disabled ends of the move buttons, and the polite live region.
const MARKUP = `
  <l-column-manager for="fixture-products"></l-column-manager>
  <l-data-table id="fixture-products">
    <table class="l-table">
      <caption>Products</caption>
      <thead><tr>
        <th scope="col" data-key="sku" data-fixed>SKU</th>
        <th scope="col" data-key="name">Name</th>
        <th scope="col" data-key="warehouse" data-hidden>Warehouse</th>
        <th scope="col" data-key="stock">In stock</th>
      </tr></thead>
      <tbody><tr><th scope="row">SKU-1042</th><td>Desk lamp</td><td>North</td><td>4,210</td></tr></tbody>
    </table>
  </l-data-table>`;

export default defineA11yFixture({
  name: 'column-manager',
  states: {
    default: MARKUP,
  },
});
