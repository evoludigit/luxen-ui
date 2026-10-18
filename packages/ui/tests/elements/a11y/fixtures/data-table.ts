import { defineA11yFixture } from '../../support/a11y-fixture.js';
import { userEvent } from '../../support/user-event.js';

// <l-data-table> renders nothing of its own except, with `selectable`, the header
// checkbox it adds to an empty `th[data-select]`. The a11y-critical surfaces are
// that checkbox's name and mixed state, that the table underneath keeps its
// caption, headers, sort buttons and named row checkboxes, and, with
// `navigable`, that rows made focusable keep the table a table, also when the
// element takes the other rows' links and checkboxes out of the Tab sequence.
const ROW = (id: string, sku: string, name: string, { link = false } = {}) => `
  <tr>
    <td data-select><input type="checkbox" class="l-checkbox" name="product" value="${id}" aria-label="Select ${sku}"></td>
    <th scope="row">${link ? `<a href="#product-${id}" data-row-link>${sku}</a>` : sku}</th>
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
    navigableLinked: {
      html: TABLE(
        ROW('a', 'SKU-1042', 'Desk lamp', { link: true }) +
          ROW('b', 'SKU-2087', 'Office chair', { link: true }) +
          ROW('c', 'SKU-3120', 'Monitor stand', { link: true }),
        'selectable navigable',
      ),
      setup: async (host) => {
        const table = host.querySelector('l-data-table') as HTMLElement & {
          rowSelection: Record<string, boolean>;
        };
        table.rowSelection = { b: true };
        await new Promise((r) => setTimeout(r, 0));
        // A key press first, so the row matches :focus-visible as it would from the keyboard.
        await userEvent.keyboard('{Shift}');
        host.querySelectorAll<HTMLElement>('tbody > tr')[1].focus();
      },
    },
  },
});
