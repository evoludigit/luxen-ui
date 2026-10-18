// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS import below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import '../../src/html/elements/data-table/index.js';
import {
  ColumnsRequestEvent,
  type ColumnChangeEvent,
  type DataTable,
} from '../../src/html/elements/data-table/data-table.js';
import { waitForEvent } from './support/events.js';

// Column order and visibility belong to the table element; the page renders the
// order it reports, and the element hides columns with a stylesheet of its own,
// never by touching the cells.

let host: HTMLElement;
afterEach(() => {
  host?.remove();
  localStorage.clear();
});

async function mount(html: string, root: HTMLElement | ShadowRoot = document.body) {
  host = document.createElement('div');
  if (root instanceof ShadowRoot) {
    root.innerHTML = html;
  } else {
    host.innerHTML = html;
    root.append(host);
  }
  const scope = root instanceof ShadowRoot ? root : host;
  await customElements.whenDefined('l-data-table');
  const el = scope.querySelector<DataTable>('l-data-table')!;
  await settle(el);
  return el;
}

async function settle(el: DataTable) {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
}

const TABLE = (attrs = '', headers = DEFAULT_HEADERS) => `
  <l-data-table ${attrs}>
    <table class="l-table">
      <caption>Products</caption>
      <thead><tr>${headers}</tr></thead>
      <tbody>
        <tr><th scope="row" class="sku">SKU-1</th><td class="name">Desk lamp</td><td class="warehouse">North</td><td class="stock">3</td></tr>
      </tbody>
    </table>
  </l-data-table>`;

const DEFAULT_HEADERS = `
  <th scope="col" data-key="sku" data-fixed>SKU</th>
  <th scope="col" data-key="name">Name</th>
  <th scope="col" data-key="warehouse" data-hidden>Warehouse</th>
  <th scope="col" data-key="stock" aria-label="Units in stock">#</th>`;

const shown = (root: ParentNode, cls: string) =>
  getComputedStyle(root.querySelector(`.${cls}`)!).display !== 'none';

describe('Columns come from the header', () => {
  it('lists every keyed column with its accessible name, flags and visibility', async () => {
    const el = await mount(TABLE());

    expect(el.columns).toEqual([
      { key: 'sku', label: 'SKU', fixed: true, visible: true },
      { key: 'name', label: 'Name', fixed: false, visible: true },
      { key: 'warehouse', label: 'Warehouse', fixed: false, visible: false },
      { key: 'stock', label: 'Units in stock', fixed: false, visible: true },
    ]);
  });

  it('states the order and visibility in TanStack Table’s shapes', async () => {
    const el = await mount(TABLE());

    expect(el.columnOrder).toEqual(['sku', 'name', 'warehouse', 'stock']);
    expect(el.columnVisibility).toEqual({ sku: true, name: true, warehouse: false, stock: true });
  });

  it('hides a data-hidden column, header and cells, without touching them', async () => {
    const el = await mount(TABLE());

    expect(shown(host, 'warehouse')).toBe(false);
    expect(shown(host, 'name')).toBe(true);
    expect(el.querySelector('.warehouse')!.getAttribute('style')).toBeNull();
  });
});

describe('The page sets columns, the user changes them', () => {
  it('applies columns set by the page without reporting them', async () => {
    const el = await mount(TABLE());
    const listener = vi.fn();
    el.addEventListener('column-change', listener);

    el.columnVisibility = { name: false, warehouse: true };
    await settle(el);

    expect(shown(host, 'name')).toBe(false);
    expect(shown(host, 'warehouse')).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('takes a visibility set by the page as the whole state: a key it leaves out is visible', async () => {
    const el = await mount(TABLE());

    el.columnVisibility = { name: false };
    await settle(el);

    expect(el.columnVisibility).toEqual({ sku: true, name: false, warehouse: true, stock: true });
  });

  it('applies an order set by the page without reporting it', async () => {
    const el = await mount(TABLE());
    const listener = vi.fn();
    el.addEventListener('column-change', listener);

    el.columnOrder = ['stock', 'sku', 'name', 'warehouse'];
    await settle(el);

    // The fixed column keeps its place; the others take the requested order.
    expect(el.columnOrder).toEqual(['sku', 'stock', 'name', 'warehouse']);
    expect(listener).not.toHaveBeenCalled();
  });

  it('applies a user change and reports the new columns', async () => {
    const el = await mount(TABLE());
    const next = waitForEvent(el, 'column-change') as Promise<ColumnChangeEvent>;

    const columns = el.columns.map((c) => (c.key === 'name' ? { ...c, visible: false } : c));
    el.dispatchEvent(new ColumnsRequestEvent(columns));
    const event = await next;

    expect(event.columnVisibility.name).toBe(false);
    expect(event.bubbles).toBe(false);
    await settle(el);
    expect(shown(host, 'name')).toBe(false);
  });

  it('reports a new order for the page to render, and never moves a cell itself', async () => {
    const el = await mount(TABLE());
    const before = el.querySelector('thead tr')!.innerHTML;
    const next = waitForEvent(el, 'column-change') as Promise<ColumnChangeEvent>;

    const [sku, name, warehouse, stock] = el.columns;
    el.dispatchEvent(new ColumnsRequestEvent([sku, stock, name, warehouse]));

    expect((await next).columnOrder).toEqual(['sku', 'stock', 'name', 'warehouse']);
    expect(el.querySelector('thead tr')!.innerHTML).toBe(before);
  });

  it('keeps fixed columns where they are, whatever the request', async () => {
    const el = await mount(TABLE());
    const next = waitForEvent(el, 'column-change') as Promise<ColumnChangeEvent>;

    const [sku, name, warehouse, stock] = el.columns;
    el.dispatchEvent(new ColumnsRequestEvent([name, { ...sku, visible: false }, warehouse, stock]));
    const event = await next;

    expect(event.columnOrder[0]).toBe(sku.key);
    expect(event.columnVisibility.sku).toBe(true);
  });

  it('follows the page when it renders the columns in the reported order', async () => {
    const el = await mount(TABLE());
    const row = el.querySelector('thead tr')!;
    row.append(row.querySelector('[data-key="name"]')!);
    const body = el.querySelector('tbody tr')!;
    body.append(body.querySelector('.name')!);
    await settle(el);

    expect(shown(host, 'warehouse')).toBe(false);
    expect(shown(host, 'name')).toBe(true);
    expect(shown(host, 'stock')).toBe(true);
  });

  it('resets to the header’s defaults', async () => {
    const el = await mount(TABLE());
    el.columnVisibility = { warehouse: true };
    await settle(el);

    el.resetColumns();
    await settle(el);

    expect(shown(host, 'warehouse')).toBe(false);
  });
});

describe('With persist-key, the user’s columns are kept', () => {
  it('stores a user change under a key derived from the element and restores it', async () => {
    let el = await mount(TABLE('persist-key="products"'));
    const columns = el.columns.map((c) => (c.key === 'name' ? { ...c, visible: false } : c));
    el.dispatchEvent(new ColumnsRequestEvent(columns));
    await settle(el);

    expect(JSON.parse(localStorage.getItem('l-data-table:products')!)).toEqual({
      v: 1,
      columnOrder: ['sku', 'name', 'warehouse', 'stock'],
      columnVisibility: { sku: true, name: false, warehouse: false, stock: true },
    });

    host.remove();
    el = await mount(TABLE('persist-key="products"'));
    expect(shown(host, 'name')).toBe(false);
  });

  it('reports a restored order once, so the page can render it', async () => {
    localStorage.setItem(
      'l-data-table:products',
      JSON.stringify({
        v: 1,
        columnOrder: ['sku', 'stock', 'name', 'warehouse'],
        columnVisibility: { warehouse: false },
      }),
    );
    host = document.createElement('div');
    host.innerHTML = TABLE('persist-key="products"');
    const el = host.querySelector<DataTable>('l-data-table')!;
    const next = waitForEvent(el, 'column-change') as Promise<ColumnChangeEvent>;
    document.body.append(host);

    expect((await next).columnOrder).toEqual(['sku', 'stock', 'name', 'warehouse']);
  });

  it('ignores stored data it cannot read', async () => {
    localStorage.setItem('l-data-table:products', '{not json');
    const el = await mount(TABLE('persist-key="products"'));

    expect(el.columnVisibility.warehouse).toBe(false);
  });

  it('keeps working when storage throws', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const el = await mount(TABLE('persist-key="products"'));
    const next = waitForEvent(el, 'column-change') as Promise<ColumnChangeEvent>;

    el.dispatchEvent(
      new ColumnsRequestEvent(
        el.columns.map(({ key, label, fixed }) => ({ key, label, fixed, visible: true })),
      ),
    );

    expect(Object.values((await next).columnVisibility).every(Boolean)).toBe(true);
    get.mockRestore();
    set.mockRestore();
  });

  it('forgets the stored columns on reset', async () => {
    const el = await mount(TABLE('persist-key="products"'));
    el.dispatchEvent(
      new ColumnsRequestEvent(
        el.columns.map(({ key, label, fixed }) => ({ key, label, fixed, visible: true })),
      ),
    );
    await settle(el);

    el.dispatchEvent(new ColumnsRequestEvent(null));
    await settle(el);

    expect(localStorage.getItem('l-data-table:products')).toBeNull();
    expect(shown(host, 'warehouse')).toBe(false);
  });
});

describe('Column widths follow the columns', () => {
  it('hides the <col> of a hidden column, so widths stay on their own columns', async () => {
    const el = await mount(`
      <l-data-table>
        <table class="l-table" style="table-layout: fixed; width: 600px">
          <colgroup><col style="width: 100px"><col style="width: 300px"><col style="width: 200px"></colgroup>
          <thead><tr>
            <th scope="col" data-key="a">A</th>
            <th scope="col" data-key="b" data-hidden>B</th>
            <th scope="col" data-key="c">C</th>
          </tr></thead>
          <tbody><tr><td class="a">1</td><td>2</td><td class="c">3</td></tr></tbody>
        </table>
      </l-data-table>`);
    await settle(el);

    expect(getComputedStyle(el.querySelector('col:nth-child(2)')!).display).toBe('none');
    // A and C keep their own widths (100 and 200), not B's 300 shifted onto C.
    const width = (c: string) => el.querySelector(c)!.getBoundingClientRect().width;
    expect(Math.round(width('.c') / width('.a'))).toBe(2);
  });
});

describe('Rows that span the table are left alone', () => {
  it('keeps a full-width row, such as an empty state, when its column is hidden', async () => {
    const el = await mount(`
      <l-data-table>
        <table class="l-table">
          <thead><tr>
            <th scope="col" data-key="a" data-hidden>A</th>
            <th scope="col" data-key="b">B</th>
          </tr></thead>
          <tbody><tr><td colspan="2" class="empty">No rows</td></tr></tbody>
        </table>
      </l-data-table>`);
    await settle(el);

    expect(shown(host, 'empty')).toBe(true);
  });
});

describe('The hiding stylesheet stays with the element', () => {
  it('reaches a table inside a shadow root', async () => {
    const outer = document.createElement('div');
    document.body.append(outer);
    const shadow = outer.attachShadow({ mode: 'open' });
    await mount(TABLE(), shadow);

    expect(shown(shadow, 'warehouse')).toBe(false);
    outer.remove();
  });

  it('is removed with the element', async () => {
    const el = await mount(TABLE());
    const sheets = document.adoptedStyleSheets.length;

    el.remove();

    expect(document.adoptedStyleSheets.length).toBe(sheets - 1);
  });
});

describe('Columns set before the table is in the page', () => {
  it('are hidden once it is inserted', async () => {
    await customElements.whenDefined('l-data-table');
    const scratch = document.createElement('div');
    scratch.innerHTML = TABLE();
    const el = scratch.querySelector<DataTable>('l-data-table')!;
    el.columnVisibility = { name: false };
    host = scratch;
    document.body.append(host);
    await settle(el);
    expect(shown(host, 'name')).toBe(false);
  });

  it('are hidden after the table leaves and comes back', async () => {
    const el = await mount(TABLE());
    el.columnVisibility = { name: false };
    el.remove();
    host.append(el);
    await settle(el);
    expect(shown(host, 'name')).toBe(false);
  });
});
