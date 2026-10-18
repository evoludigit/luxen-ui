import { defineA11yFixture } from '../../support/a11y-fixture.js';

// <l-data-table> renders nothing of its own except, with `selectable`, the header
// checkbox it adds to an empty `th[data-select]`. The a11y-critical surfaces are
// that checkbox's name and mixed state, that the table underneath keeps its
// caption, headers, sort buttons and named row checkboxes, and, with
// `navigable`, that rows made focusable keep the table a table.
const ROW = (id: string, sku: string, name: string, checked = '') => `
  <tr>
    <td data-select><input type="checkbox" class="l-checkbox" name="product" value="${id}" aria-label="Select ${sku}" ${checked}></td>
    <th scope="row">${sku}</th>
    <td>${name}</td>
  </tr>`;

const TABLE = (rows: string, attrs = 'selectable') => `
  <l-data-table ${attrs}>
    <table class="l-table">
      <caption>Products</caption>
      <thead>
        <tr>
          <th scope="col" data-select></th>
          <th scope="col" data-key="sku" aria-sort="ascending"><button type="button">SKU</button></th>
          <th scope="col" data-key="name"><button type="button">Name</button></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </l-data-table>`;

export default defineA11yFixture({
  name: 'data-table',
  states: {
    selectable: TABLE(ROW('a', 'SKU-1042', 'Desk lamp') + ROW('b', 'SKU-2087', 'Office chair')),
    someSelected: {
      html: TABLE(ROW('a', 'SKU-1042', 'Desk lamp') + ROW('b', 'SKU-2087', 'Office chair')),
      setup: async (host) => {
        const table = host.querySelector('l-data-table') as HTMLElement & {
          rowSelection: Record<string, boolean>;
        };
        table.rowSelection = { a: true };
        await new Promise((r) => setTimeout(r, 0));
      },
    },
    navigable: {
      html: TABLE(
        ROW('a', 'SKU-1042', 'Desk lamp') + ROW('b', 'SKU-2087', 'Office chair'),
        'selectable navigable',
      ),
      setup: async (host) => {
        await new Promise((r) => setTimeout(r, 0));
        host.querySelector<HTMLElement>('tbody > tr')!.focus();
      },
    },
  },
});
