// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS import below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';
import '../../src/html/elements/data-table/index.js';
import '../../src/html/translations/fr.js';
import type {
  DataTable,
  DataTableSelectionChangeEvent,
  SortChangeEvent,
} from '../../src/html/elements/data-table/data-table.js';
import { userEvent } from './support/user-event.js';
import { waitForEvent } from './support/events.js';

// <l-data-table> adds behaviour to an authored `.l-table` and renders nothing of
// its own except, with `selectable`, the header checkbox that only makes sense
// once the script runs. Sorting is reported, never applied: the page renders
// `aria-sort` and the rows.

let host: HTMLElement;
afterEach(() => host?.remove());

async function mount(html: string) {
  host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  await customElements.whenDefined('l-data-table');
  await settle();
  return host.querySelector<DataTable>('l-data-table')!;
}

async function settle() {
  const table = host?.querySelector<DataTable>('l-data-table');
  if (table) await table.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
}

const ROW = (id: string, sku: string, input = 'checkbox') => `
  <tr>
    <td data-select><input type="${input}" name="product" value="${id}" aria-label="Select ${sku}"></td>
    <th scope="row">${sku}</th>
    <td>Item ${id}</td>
  </tr>`;

const TABLE = ({
  attrs = '',
  head = '<th scope="col" data-select></th>',
  rows = ROW('a', 'SKU-1') + ROW('b', 'SKU-2') + ROW('c', 'SKU-3') + ROW('d', 'SKU-4'),
  sort = '',
} = {}) => `
  <l-data-table ${attrs}>
    <table class="l-table">
      <caption>Products</caption>
      <thead>
        <tr>
          ${head}
          <th scope="col" data-key="sku" ${sort}><button type="button">SKU</button></th>
          <th scope="col" data-key="name"><button type="button">Name</button></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </l-data-table>`;

const checkbox = (name: string) =>
  page.getByRole('checkbox', { name, exact: true }).element() as HTMLInputElement;
const row = (sku: string) => checkbox(`Select ${sku}`);
const header = () => checkbox('Select all rows on this page');
const checkedSkus = () =>
  [...host.querySelectorAll<HTMLInputElement>('tbody input')]
    .filter((i) => i.checked)
    .map((i) => i.value);

describe('A data table enhances the table it wraps', () => {
  it('adds nothing to the table without selection', async () => {
    const markup = TABLE();
    const el = await mount(markup);
    const before = document.createElement('div');
    before.innerHTML = markup;

    expect(el.querySelector('table')!.innerHTML).toBe(before.querySelector('table')!.innerHTML);
    expect(el.children).toHaveLength(1);
  });

  it('upgrades a table parsed after the element connects', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const el = document.createElement('l-data-table') as DataTable;
    el.setAttribute('selectable', '');
    host.append(el);
    await settle();
    el.innerHTML = TABLE().replace(/<\/?l-data-table[^>]*>/g, '');
    await settle();

    expect(header()).toBeTruthy();
  });
});

describe('A sortable header reports the sort the page should apply', () => {
  it('reports the next sort on activation, without touching aria-sort', async () => {
    const el = await mount(TABLE());
    const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

    await userEvent.click(page.getByRole('button', { name: 'Name' }));
    const event = await next;

    expect(event.sort).toEqual({ key: 'name', direction: 'ascending' });
    expect(el.querySelector('th[data-key="name"]')!.hasAttribute('aria-sort')).toBe(false);
    expect(event.bubbles).toBe(false);
    expect(event.cancelable).toBe(false);
  });

  it('cycles from the state the markup holds', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="ascending"' }));
    const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

    await userEvent.click(page.getByRole('button', { name: 'SKU' }));

    expect((await next).sort).toEqual({ key: 'sku', direction: 'descending' });
  });

  it('reports no sort after descending', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="descending"' }));
    const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

    await userEvent.click(page.getByRole('button', { name: 'SKU' }));

    expect((await next).sort).toBeNull();
  });

  it('reads its sort from the markup, following the page', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="ascending"' }));
    expect(el.sort).toEqual({ key: 'sku', direction: 'ascending' });

    el.querySelector('th[data-key="sku"]')!.removeAttribute('aria-sort');
    el.querySelector('th[data-key="name"]')!.setAttribute('aria-sort', 'descending');

    expect(el.sort).toEqual({ key: 'name', direction: 'descending' });
  });

  it('leaves a header link alone: following it is the sort', async () => {
    const el = await mount(
      TABLE().replace('<button type="button">Name</button>', '<a href="#sorted">Name</a>'),
    );
    const listener = vi.fn();
    el.addEventListener('sort-change', listener);

    await userEvent.click(page.getByRole('link', { name: 'Name' }));

    expect(listener).not.toHaveBeenCalled();
    expect(location.hash).toBe('#sorted');
    history.replaceState(null, '', location.pathname);
  });
});

describe('With selectable, rows are selected through their own checkboxes', () => {
  it('adds a header checkbox, once the script runs, to an empty selection header', async () => {
    await mount(TABLE({ attrs: 'selectable' }));

    expect(header()).toBeTruthy();
    expect(host.querySelectorAll('thead [data-select] input')).toHaveLength(1);
  });

  it('uses an authored header checkbox instead of adding one', async () => {
    await mount(
      TABLE({
        attrs: 'selectable',
        head: '<th scope="col" data-select><input type="checkbox" aria-label="All products"></th>',
      }),
    );

    expect(host.querySelectorAll('thead [data-select] input')).toHaveLength(1);
    await userEvent.click(checkbox('All products'));
    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reports a change with the selected keys', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    const next = waitForEvent(el, 'selection-change') as Promise<DataTableSelectionChangeEvent>;

    await userEvent.click(row('SKU-2'));
    const event = await next;

    expect(event.selectedKeys).toEqual(['b']);
    expect(event.allVisibleSelected).toBe(false);
    expect(event.allMatching).toBe(false);
    expect(event.bubbles).toBe(false);
  });

  it('shows a mixed header while some rows are selected, and selects or clears the page from it', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));

    await userEvent.click(row('SKU-2'));
    expect(header().indeterminate).toBe(true);

    await userEvent.click(header());
    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
    expect(header().checked).toBe(true);
    expect(header().indeterminate).toBe(false);

    await userEvent.click(header());
    expect(checkedSkus()).toEqual([]);
    expect(el.selectedKeys).toEqual([]);
  });

  it('selects a range with Shift and a click', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));

    await userEvent.click(row('SKU-1'));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(row('SKU-3'));
    await userEvent.keyboard('{/Shift}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c']);
    expect(new Set(el.selectedKeys)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('selects a range with Shift and Space (WCAG 2.1.1 / RGAA 7.3)', async () => {
    await mount(TABLE({ attrs: 'selectable' }));

    await userEvent.click(row('SKU-2'));
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(row('SKU-4'));
    await userEvent.keyboard('{Shift>}{ }{/Shift}');

    expect(checkedSkus()).toEqual(['b', 'c', 'd']);
  });

  it('keeps a selected row selected while its row is gone, and checks it when it returns', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    await userEvent.click(row('SKU-2'));

    const tbody = el.querySelector('tbody')!;
    tbody.innerHTML = ROW('e', 'SKU-5');
    await settle();
    expect(el.selectedKeys).toEqual(['b']);

    tbody.innerHTML = ROW('a', 'SKU-1') + ROW('b', 'SKU-2');
    await settle();
    expect(row('SKU-2').checked).toBe(true);
  });

  it('takes a selection from the page without reporting it', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    const listener = vi.fn();
    el.addEventListener('selection-change', listener);

    el.selectedKeys = ['a', 'c', 'x'];
    await settle();

    expect(checkedSkus()).toEqual(['a', 'c']);
    expect(el.selectedKeys).toEqual(['a', 'c', 'x']);
    el.clearSelection();
    await settle();
    expect(checkedSkus()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports when every visible row is selected, and drops "all matching" on the next change', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    const all = waitForEvent(el, 'selection-change') as Promise<DataTableSelectionChangeEvent>;
    await userEvent.click(header());
    expect((await all).allVisibleSelected).toBe(true);

    el.allMatching = true;
    const next = waitForEvent(el, 'selection-change') as Promise<DataTableSelectionChangeEvent>;
    await userEvent.click(row('SKU-1'));
    const event = await next;

    expect(event.allMatching).toBe(false);
    expect(el.allMatching).toBe(false);
  });

  it('selects one row at a time with radios, and adds no header checkbox', async () => {
    const rows = ROW('a', 'SKU-1', 'radio') + ROW('b', 'SKU-2', 'radio');
    const el = await mount(TABLE({ attrs: 'selectable', rows }));

    await userEvent.click(page.getByRole('radio', { name: 'Select SKU-1' }));
    await userEvent.click(page.getByRole('radio', { name: 'Select SKU-2' }));

    expect(el.selectedKeys).toEqual(['b']);
    expect(host.querySelectorAll('thead input')).toHaveLength(0);
  });

  it('leaves checkboxes alone without selectable', async () => {
    const el = await mount(TABLE());
    const listener = vi.fn();
    el.addEventListener('selection-change', listener);

    await userEvent.click(row('SKU-1'));

    expect(listener).not.toHaveBeenCalled();
    expect(host.querySelectorAll('thead input')).toHaveLength(0);
  });

  it('warns once about a row checkbox without an accessible name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount(
      TABLE({ attrs: 'selectable', rows: ROW('a', 'SKU-1').replace(/ aria-label="[^"]*"/, '') }),
    );

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('Accessibility', () => {
  describe('Roles and accessible names', () => {
    it('names the added header checkbox in the page language (WCAG 4.1.2 / RGAA 7.1)', async () => {
      await mount(`<div lang="fr">${TABLE({ attrs: 'selectable' })}</div>`);

      expect(checkbox('Sélectionner les lignes de la page')).toBeTruthy();
    });

    it('renames the added header checkbox when the document language changes', async () => {
      const previous = document.documentElement.lang;
      await mount(TABLE({ attrs: 'selectable' }));
      document.documentElement.lang = 'fr';
      await settle();
      await settle();

      expect(checkbox('Sélectionner les lignes de la page')).toBeTruthy();
      document.documentElement.lang = previous;
    });

    it('keeps the table a table, with its caption and headers', async () => {
      await mount(TABLE({ attrs: 'selectable' }));

      expect(await page.getByRole('table', { name: 'Products' }).query()).toBeTruthy();
      expect(await page.getByRole('rowheader', { name: 'SKU-1' }).query()).toBeTruthy();
    });
  });

  describe('Keyboard interaction (APG Sortable Table)', () => {
    it('sorts from a header button with Enter (WCAG 2.1.1 / RGAA 7.3)', async () => {
      const el = await mount(TABLE());
      const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

      await userEvent.tab();
      await userEvent.keyboard('{Enter}');

      expect((await next).sort).toEqual({ key: 'sku', direction: 'ascending' });
    });
  });

  describe('Focus management', () => {
    it('keeps focus on a row checkbox through a range selection (WCAG 2.4.3 / RGAA 12.8)', async () => {
      await mount(TABLE({ attrs: 'selectable' }));

      await userEvent.click(row('SKU-1'));
      await userEvent.tab();
      await userEvent.keyboard('{Shift>}{ }{/Shift}');

      expect(document.activeElement).toBe(row('SKU-2'));
    });
  });
});
