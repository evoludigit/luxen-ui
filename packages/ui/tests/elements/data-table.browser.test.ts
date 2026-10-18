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

    expect(event.sorting).toEqual([{ id: 'name', desc: false }]);
    expect(el.querySelector('th[data-key="name"]')!.hasAttribute('aria-sort')).toBe(false);
    expect(event.bubbles).toBe(false);
    expect(event.cancelable).toBe(false);
  });

  it('cycles from the state the markup holds', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="ascending"' }));
    const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

    await userEvent.click(page.getByRole('button', { name: 'SKU' }));

    expect((await next).sorting).toEqual([{ id: 'sku', desc: true }]);
  });

  it('reports no sort after descending', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="descending"' }));
    const next = waitForEvent(el, 'sort-change') as Promise<SortChangeEvent>;

    await userEvent.click(page.getByRole('button', { name: 'SKU' }));

    expect((await next).sorting).toEqual([]);
  });

  it('reads its sort from the markup, following the page', async () => {
    const el = await mount(TABLE({ sort: 'aria-sort="ascending"' }));
    expect(el.sorting).toEqual([{ id: 'sku', desc: false }]);

    el.querySelector('th[data-key="sku"]')!.removeAttribute('aria-sort');
    el.querySelector('th[data-key="name"]')!.setAttribute('aria-sort', 'descending');

    expect(el.sorting).toEqual([{ id: 'name', desc: true }]);
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

    expect(event.rowSelection).toEqual({ b: true });
    expect(event.allPageRowsSelected).toBe(false);
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
    expect(el.rowSelection).toEqual({});
  });

  it('selects a range with Shift and a click', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));

    await userEvent.click(row('SKU-1'));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(row('SKU-3'));
    await userEvent.keyboard('{/Shift}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c']);
    expect(new Set(Object.keys(el.rowSelection))).toEqual(new Set(['a', 'b', 'c']));
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
    expect(el.rowSelection).toEqual({ b: true });

    tbody.innerHTML = ROW('a', 'SKU-1') + ROW('b', 'SKU-2');
    await settle();
    expect(row('SKU-2').checked).toBe(true);
  });

  it('takes a selection from the page without reporting it', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    const listener = vi.fn();
    el.addEventListener('selection-change', listener);

    el.rowSelection = { a: true, c: true, x: true };
    await settle();

    expect(checkedSkus()).toEqual(['a', 'c']);
    expect(el.rowSelection).toEqual({ a: true, c: true, x: true });
    el.clearSelection();
    await settle();
    expect(checkedSkus()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('selects only the keys a RowSelectionState sets to true', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));

    el.rowSelection = { a: true, b: false };
    await settle();

    expect(el.rowSelection).toEqual({ a: true });
    expect(checkedSkus()).toEqual(['a']);
  });

  it('reports when every visible row is selected, and drops "all matching" on the next change', async () => {
    const el = await mount(TABLE({ attrs: 'selectable' }));
    const all = waitForEvent(el, 'selection-change') as Promise<DataTableSelectionChangeEvent>;
    await userEvent.click(header());
    expect((await all).allPageRowsSelected).toBe(true);

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

    expect(el.rowSelection).toEqual({ b: true });
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

describe('With navigable, rows are reached and selected from the keyboard', () => {
  const LINKED = (id: string, sku: string) => `
    <tr>
      <td data-select><input type="checkbox" name="product" value="${id}" aria-label="Select ${sku}"></td>
      <th scope="row"><a href="#product-${id}" data-row-link>${sku}</a></th>
      <td>Item ${id}</td>
    </tr>`;
  const bodyRows = () => [...host.querySelectorAll<HTMLTableRowElement>('tbody > tr')];
  const rowOf = (sku: string) => bodyRows().find((tr) => tr.textContent.includes(sku))!;
  const cellOf = (id: string) =>
    page.getByRole('cell', { name: `Item ${id}`, exact: true }).element();
  const focusedSku = () =>
    (document.activeElement as HTMLElement).closest('tr')?.querySelector('th')?.textContent?.trim();
  const LINKED_ROWS = ['a', 'b', 'c', 'd'].map((id, i) => LINKED(id, `SKU-${i + 1}`)).join('');
  /** A linked, selectable table between two focusable elements. */
  const mountBetween = (attrs = 'selectable navigable') =>
    mount(`
      <button type="button" id="before">Before</button>
      ${TABLE({ attrs, rows: LINKED_ROWS })}
      <input id="after" aria-label="After">`);
  const before = () => host.querySelector<HTMLButtonElement>('#before')!;
  const after = () => host.querySelector<HTMLInputElement>('#after')!;
  const linkOf = (sku: string) => rowOf(sku).querySelector('a')!;

  it('makes one row the tab stop of the body: the first one, until another is reached', async () => {
    await mount(TABLE({ attrs: 'navigable' }));

    expect(bodyRows().map((tr) => tr.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
  });

  it('writes no tabindex without navigable', async () => {
    await mount(TABLE());

    expect(bodyRows().some((tr) => tr.hasAttribute('tabindex'))).toBe(false);
  });

  it('focuses a row when a plain cell is clicked, and makes it the tab stop', async () => {
    await mount(TABLE({ attrs: 'navigable' }));

    await userEvent.click(cellOf('c'));

    expect(document.activeElement).toBe(rowOf('SKU-3'));
    expect(rowOf('SKU-3').getAttribute('tabindex')).toBe('0');
    expect(rowOf('SKU-1').getAttribute('tabindex')).toBe('-1');
  });

  it('moves between rows with the arrows, Home and End, and stops at the ends', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('a'));

    await userEvent.keyboard('{ArrowDown}');
    expect(focusedSku()).toBe('SKU-2');
    await userEvent.keyboard('{End}');
    expect(focusedSku()).toBe('SKU-4');
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedSku()).toBe('SKU-4');
    await userEvent.keyboard('{Home}');
    expect(focusedSku()).toBe('SKU-1');
    await userEvent.keyboard('{ArrowUp}');
    expect(focusedSku()).toBe('SKU-1');
  });

  it('moves ten rows with Page Down and Page Up', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ROW(`r${i + 1}`, `SKU-${i + 1}`)).join('');
    await mount(TABLE({ attrs: 'navigable', rows }));
    await userEvent.click(cellOf('r1'));

    await userEvent.keyboard('{PageDown}');
    expect(focusedSku()).toBe('SKU-11');
    await userEvent.keyboard('{PageDown}');
    expect(focusedSku()).toBe('SKU-12');
    await userEvent.keyboard('{PageUp}');
    expect(focusedSku()).toBe('SKU-2');
  });

  it('toggles the focused row with Space, reporting it once', async () => {
    const el = await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('b'));
    const events: DataTableSelectionChangeEvent[] = [];
    el.addEventListener('selection-change', (e) => events.push(e));

    await userEvent.keyboard('{ }');

    expect(checkedSkus()).toEqual(['b']);
    expect(events).toHaveLength(1);
    expect(events[0].rowSelection).toEqual({ b: true });
    expect(document.activeElement).toBe(rowOf('SKU-2'));
  });

  it('extends the selection with Shift and the arrows', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));

    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
    expect(focusedSku()).toBe('SKU-4');
  });

  it('extends from the focused row, not from a row toggled before plain moves', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));

    await userEvent.keyboard('{ }{ArrowDown}{ArrowDown}{Shift>}{ArrowDown}{/Shift}');

    expect(checkedSkus()).toEqual(['a', 'c', 'd']);
  });

  it('shrinks the selection with Shift and the opposite arrow', async () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ROW(id, `SKU-${i + 1}`)).join('');
    await mount(TABLE({ attrs: 'selectable navigable', rows }));
    await userEvent.click(cellOf('b'));

    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{ArrowUp}{/Shift}');

    expect(checkedSkus()).toEqual(['b', 'c']);
    expect(focusedSku()).toBe('SKU-3');
  });

  it('extends with Shift and End, Home, Page Down or Page Up', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('b'));

    await userEvent.keyboard('{Shift>}{End}{/Shift}');
    expect(checkedSkus()).toEqual(['b', 'c', 'd']);
    await userEvent.keyboard('{Shift>}{Home}{/Shift}');
    expect(checkedSkus()).toEqual(['a', 'b']);
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    expect(checkedSkus()).toEqual(['b', 'c', 'd']);
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    expect(checkedSkus()).toEqual(['a', 'b']);
  });

  it('starts a new run after a plain move', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));

    await userEvent.keyboard(
      '{Shift>}{ArrowDown}{/Shift}{ArrowDown}{ArrowDown}{Shift>}{ArrowUp}{/Shift}',
    );

    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('selects a range with Shift and Space from the last row toggled', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));

    await userEvent.keyboard('{ }{ArrowDown}{ArrowDown}{Shift>}{ }{/Shift}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c']);
  });

  it('clears the selection with Escape, reporting it', async () => {
    const el = await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));
    await userEvent.keyboard('{ }{ArrowDown}{ }');
    const cleared = waitForEvent(el, 'selection-change') as Promise<DataTableSelectionChangeEvent>;

    await userEvent.keyboard('{Escape}');

    expect((await cleared).rowSelection).toEqual({});
    expect(checkedSkus()).toEqual([]);
  });

  /** Whether the page saw `key` prevented, once the element has handled it. */
  const preventedOnPage = (key: string) => {
    const seen: boolean[] = [];
    const listener = (e: KeyboardEvent) => {
      if (e.key === key) seen.push(e.defaultPrevented);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      return seen;
    };
  };

  it('leaves a radio selection alone on Escape, and lets Escape through', async () => {
    const rows = ['a', 'b', 'c', 'd'].map((id, i) => ROW(id, `SKU-${i + 1}`, 'radio')).join('');
    await mount(TABLE({ attrs: 'selectable navigable', rows }));
    await userEvent.click(cellOf('a'));
    await userEvent.keyboard('{ }');
    const prevented = preventedOnPage('Escape');

    await userEvent.keyboard('{Escape}');

    expect(checkedSkus()).toEqual(['a']);
    expect(prevented()).toEqual([false]);
  });

  it('keeps the page still on Space on a row without a selection input', async () => {
    const plain = (id: string, sku: string) =>
      `<tr id="p-${id}"><th scope="row">${sku}</th><td>Item ${id}</td></tr>`;
    await mount(
      TABLE({ attrs: 'navigable', head: '', rows: plain('a', 'SKU-1') + plain('b', 'SKU-2') }),
    );
    await userEvent.click(cellOf('a'));
    const prevented = preventedOnPage(' ');

    await userEvent.keyboard('{ }');

    expect(prevented()).toEqual([true]);
  });

  it('clears rows on other pages too with Escape, reporting it', async () => {
    const el = await mount(TABLE({ attrs: 'selectable navigable' }));
    el.rowSelection = { a: true, elsewhere: true };
    await settle();
    await userEvent.click(cellOf('a'));
    const events: DataTableSelectionChangeEvent[] = [];
    el.addEventListener('selection-change', (e) => events.push(e));

    await userEvent.keyboard('{Escape}');

    expect(el.rowSelection).toEqual({});
    expect(events).toHaveLength(1);
  });

  it('selects every row on the page with Ctrl+A or Cmd+A on a row, reporting it once', async () => {
    const el = await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(cellOf('a'));
    const events: DataTableSelectionChangeEvent[] = [];
    el.addEventListener('selection-change', (e) => events.push(e));

    await userEvent.keyboard('{Control>}a{/Control}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
    expect(events).toHaveLength(1);
    expect(events[0].allPageRowsSelected).toBe(true);
    expect(getSelection()?.toString()).toBe('');

    await userEvent.keyboard('{Escape}{Meta>}a{/Meta}');

    expect(checkedSkus()).toEqual(['a', 'b', 'c', 'd']);
    expect(getSelection()?.toString()).toBe('');
  });

  it('leaves Ctrl+A to the browser with radios', async () => {
    const rows = ['a', 'b', 'c', 'd'].map((id, i) => ROW(id, `SKU-${i + 1}`, 'radio')).join('');
    await mount(TABLE({ attrs: 'selectable navigable', rows }));
    await userEvent.click(cellOf('a'));
    const prevented = preventedOnPage('a');

    await userEvent.keyboard('{Control>}a{/Control}');

    expect(checkedSkus()).toEqual([]);
    expect(prevented()).toEqual([false]);
    getSelection()?.removeAllRanges();
  });

  it('opens the focused row with Enter by following its row link', async () => {
    const rows = LINKED('a', 'SKU-1') + LINKED('b', 'SKU-2');
    await mount(TABLE({ attrs: 'navigable', rows }));
    const followed: string[] = [];
    host.addEventListener('click', (e) => {
      const link = (e.target as Element).closest('a');
      if (link) {
        e.preventDefault();
        followed.push(link.getAttribute('href')!);
      }
    });
    rowOf('SKU-2').focus();

    await userEvent.keyboard('{Enter}');

    expect(followed).toEqual(['#product-b']);
  });

  it('leaves keys alone while focus is on a control inside a row', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    await userEvent.click(row('SKU-1'));

    await userEvent.keyboard('{ArrowDown}');

    expect(document.activeElement).toBe(row('SKU-1'));
  });

  it('keeps the focused row, by its key, when the page re-renders and re-sorts the rows', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('c'));

    host.querySelector('tbody')!.innerHTML =
      ROW('d', 'SKU-4') + ROW('c', 'SKU-3') + ROW('b', 'SKU-2') + ROW('a', 'SKU-1');
    await settle();

    expect(rowOf('SKU-3').getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(rowOf('SKU-3'));
    expect(bodyRows().filter((tr) => tr.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it("enters the body on the remembered row with Tab, past the rows' controls (WCAG 2.4.3 / RGAA 12.8)", async () => {
    await mountBetween();
    await userEvent.click(cellOf('c'));
    before().focus();

    // The header checkbox and the two sort buttons, then the body.
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}');

    expect(document.activeElement).toBe(rowOf('SKU-3'));
  });

  it('returns to the remembered row with Shift+Tab from after the table', async () => {
    await mountBetween();
    await userEvent.click(cellOf('c'));
    after().focus();

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(linkOf('SKU-3'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(row('SKU-3'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(rowOf('SKU-3'));
  });

  it('moves from a row into its own controls with Tab, then out of the table', async () => {
    await mountBetween();
    rowOf('SKU-2').focus();

    await userEvent.tab();
    expect(document.activeElement).toBe(row('SKU-2'));
    await userEvent.tab();
    expect(document.activeElement).toBe(linkOf('SKU-2'));
    await userEvent.tab();
    expect(document.activeElement).toBe(after());
  });

  it('keeps focus on the row when the page moves the row nodes, as a keyed list re-sorts', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('b'));
    await userEvent.keyboard('{ArrowDown}');

    const tbody = host.querySelector('tbody')!;
    for (const tr of Array.from(tbody.rows)) tbody.prepend(tr);
    await settle();

    expect(document.activeElement).toBe(rowOf('SKU-3'));
    expect(bodyRows().filter((tr) => tr.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  describe('Focus is never taken back once the user has moved on', () => {
    const FOUR = ROW('a', 'SKU-1') + ROW('b', 'SKU-2') + ROW('c', 'SKU-3') + ROW('d', 'SKU-4');
    const mountWithAfter = () =>
      mount(`${TABLE({ attrs: 'navigable' })}<input id="after" aria-label="After">`);
    const render = async (rows: string) => {
      host.querySelector('tbody')!.innerHTML = rows;
      await settle();
    };

    it('does not take focus back after the user has moved on', async () => {
      await mountWithAfter();
      await userEvent.click(cellOf('a'));
      await userEvent.keyboard('{ArrowDown}');
      await render('<tr><td colspan="4">No products</td></tr>');

      await userEvent.click(after());
      await userEvent.keyboard('abc');
      await render(FOUR);

      expect(document.activeElement).toBe(after());
    });

    it('does not take focus when rows re-render while focus was never in them', async () => {
      await mountWithAfter();
      after().focus();

      await render(FOUR);

      expect(document.activeElement).toBe(after());
    });

    it('does not take focus back after a click on a blank part of the page', async () => {
      await mountWithAfter();
      await userEvent.click(cellOf('a'));
      await userEvent.keyboard('{ArrowDown}');

      await userEvent.click(host.querySelector('caption')!);
      await new Promise((r) => setTimeout(r, 0));
      await render(FOUR);

      expect(document.activeElement).toBe(document.body);
    });
  });

  describe('Rows without a selection input keep their place by id', () => {
    const PLAIN = (n: number, id = '') =>
      `<tr${id && ` id="${id}"`}><th scope="row">SKU-${n}</th><td>Item ${n}</td></tr>`;
    const plainRows = (ids: boolean, order = [1, 2, 3, 4]) =>
      order.map((n) => PLAIN(n, ids ? `p-${n}` : '')).join('');

    it('warns once when navigable rows have neither a selection value nor an id', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await mount(TABLE({ attrs: 'navigable', head: '', rows: plainRows(false) }));

      host.querySelector('tbody')!.innerHTML = plainRows(false, [4, 3, 2, 1]);
      await settle();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('id');
      warn.mockRestore();
    });

    it('keeps the focused row by id across a re-sort', async () => {
      await mount(TABLE({ attrs: 'navigable', head: '', rows: plainRows(true) }));
      await userEvent.click(cellOf('2'));

      host.querySelector('tbody')!.innerHTML = plainRows(true, [4, 3, 2, 1]);
      await settle();

      expect(document.activeElement?.id).toBe('p-2');
    });
  });

  it('returns focus to the row when a re-render replaces the row whose checkbox had focus', async () => {
    await mount(TABLE({ attrs: 'selectable navigable' }));
    row('SKU-2').focus();

    host.querySelector('tbody')!.innerHTML =
      ROW('a', 'SKU-1') + ROW('b', 'SKU-2') + ROW('c', 'SKU-3') + ROW('d', 'SKU-4');
    await settle();

    expect(document.activeElement).toBe(rowOf('SKU-2'));
  });

  it('moves focus to the next row when the focused row is removed', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('a'));
    await userEvent.keyboard('{ArrowDown}');

    rowOf('SKU-2').remove();
    await settle();

    expect(document.activeElement).toBe(rowOf('SKU-3'));
    expect(rowOf('SKU-3').getAttribute('tabindex')).toBe('0');
    expect(rowOf('SKU-1').getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to the previous row when the last row is removed', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('a'));
    await userEvent.keyboard('{End}');

    rowOf('SKU-4').remove();
    await settle();

    expect(document.activeElement).toBe(rowOf('SKU-3'));
  });

  it('leaves focus alone when the last row goes and an empty state takes its place', async () => {
    await mount(TABLE({ attrs: 'navigable' }));
    await userEvent.click(cellOf('a'));
    await userEvent.keyboard('{ArrowDown}');
    const tbody = host.querySelector('tbody')!;

    tbody.innerHTML = '<tr><td colspan="4">No products</td></tr>';
    await settle();
    expect(tbody.querySelector('[tabindex]')).toBeNull();

    tbody.innerHTML = ROW('a', 'SKU-1') + ROW('b', 'SKU-2') + ROW('c', 'SKU-3') + ROW('d', 'SKU-4');
    await settle();
    expect(document.activeElement?.closest('tr')).toBeNull();
  });

  it("gives the rows' controls their own tabindex back when navigable is turned off", async () => {
    const rows = LINKED_ROWS.replace('href="#product-b"', 'href="#product-b" tabindex="-1"');
    const el = await mount(TABLE({ attrs: 'selectable navigable', rows }));
    rowOf('SKU-4').focus();

    el.navigable = false;
    await settle();

    expect(linkOf('SKU-2').getAttribute('tabindex')).toBe('-1');
    const others = [...host.querySelectorAll('tbody :is(a, input)')].filter(
      (c) => c !== linkOf('SKU-2'),
    );
    expect(others.filter((c) => c.hasAttribute('tabindex'))).toEqual([]);
  });

  it('makes a row the tab stop when one of its controls is clicked', async () => {
    await mount(TABLE({ attrs: 'selectable navigable', rows: LINKED_ROWS }));

    await userEvent.click(row('SKU-4'));

    expect(rowOf('SKU-4').getAttribute('tabindex')).toBe('0');
    expect(linkOf('SKU-4').hasAttribute('tabindex')).toBe(false);
    expect(linkOf('SKU-1').getAttribute('tabindex')).toBe('-1');
  });

  it('removes the tabindex it wrote when navigable is turned off', async () => {
    const el = await mount(TABLE({ attrs: 'navigable' }));

    el.navigable = false;
    await settle();

    expect(bodyRows().some((tr) => tr.hasAttribute('tabindex'))).toBe(false);
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

      expect((await next).sorting).toEqual([{ id: 'sku', desc: false }]);
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
