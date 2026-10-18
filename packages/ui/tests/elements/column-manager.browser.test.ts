// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS import below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';
import '../../src/css/preset.css';
import '../../src/css/elements/column-manager.css';
import '../../src/html/elements/data-table/index.js';
import '../../src/html/elements/column-manager/index.js';
import '../../src/html/translations/fr.js';
import type {
  ColumnChangeEvent,
  DataTable,
} from '../../src/html/elements/data-table/data-table.js';
import { userEvent } from './support/user-event.js';
import { waitForEvent } from './support/events.js';

// <l-column-manager for> edits the columns of the l-data-table it names. Every
// change goes through the table, which applies it, keeps it and reports it.

let host: HTMLElement;
afterEach(() => {
  host?.remove();
  localStorage.clear();
});

const MARKUP = (managerAttrs = 'for="products"') => `
  <l-column-manager ${managerAttrs}></l-column-manager>
  <l-data-table id="products">
    <table class="l-table">
      <caption>Products</caption>
      <thead><tr>
        <th scope="col" data-key="sku" data-fixed>SKU</th>
        <th scope="col" data-key="name">Name</th>
        <th scope="col" data-key="warehouse">Warehouse</th>
        <th scope="col" data-key="supplier" data-hidden>Supplier</th>
        <th scope="col" data-key="stock">In stock</th>
      </tr></thead>
      <tbody><tr><th scope="row">SKU-1</th><td>Desk lamp</td><td>North</td><td>Northwind</td><td>3</td></tr></tbody>
    </table>
  </l-data-table>`;

async function mount(markup = MARKUP()) {
  host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  await customElements.whenDefined('l-column-manager');
  await settle();
  return host.querySelector<DataTable>('l-data-table')!;
}

async function settle() {
  const elements = host.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>(
    'l-data-table, l-column-manager',
  );
  await Promise.all([...elements].map((el) => el.updateComplete));
  await new Promise((r) => setTimeout(r, 0));
}

const list = (name: string) => page.getByRole('list', { name }).element();
const items = (name: string) =>
  // The drop hint of an empty list is presentational, not an item.
  [...list(name).querySelectorAll('li:not([role="presentation"])')].map(
    (li) => li.dataset.key ?? (li.textContent ?? '').trim(),
  );
const button = (name: string) => page.getByRole('button', { name, exact: true }).element();
const status = () => (host.querySelector('[role="status"]')?.textContent ?? '').trim();
const order = (table: DataTable) => table.columns.map((c) => c.key);

describe('The manager lists the table’s columns', () => {
  it('shows the visible, hidden and fixed columns in three named lists', async () => {
    await mount();

    expect(items('Shown columns')).toEqual(['name', 'warehouse', 'stock']);
    expect(items('Hidden columns')).toEqual(['supplier']);
    expect(items('Fixed columns')).toEqual(['sku']);
  });

  it('gives fixed columns no controls', async () => {
    await mount();

    expect(list('Fixed columns').querySelectorAll('button')).toHaveLength(0);
  });

  it('follows changes the page makes to the table', async () => {
    const table = await mount();

    table.columnVisibility = Object.fromEntries(table.columnOrder.map((key) => [key, true]));
    await settle();

    expect(items('Hidden columns')).toEqual([]);
  });

  it('binds to another table when `for` changes', async () => {
    await mount(
      MARKUP() +
        `<l-data-table id="other"><table class="l-table"><thead><tr><th scope="col" data-key="only">Only</th></tr></thead><tbody></tbody></table></l-data-table>`,
    );

    host.querySelector('l-column-manager')!.setAttribute('for', 'other');
    await settle();

    expect(items('Shown columns')).toEqual(['only']);
  });
});

describe('Showing and hiding a column', () => {
  it('hides a column from its eye button and announces it', async () => {
    const table = await mount();
    const next = waitForEvent(table, 'column-change') as Promise<ColumnChangeEvent>;

    await userEvent.click(button('Hide column Name'));
    await next;
    await settle();

    expect(items('Hidden columns')).toEqual(['name', 'supplier']);
    expect(table.columns.find((c) => c.key === 'name')!.visible).toBe(false);
    expect(status()).toBe('Name hidden');
  });

  it('shows a hidden column again', async () => {
    const table = await mount();

    await userEvent.click(button('Show column Supplier'));
    await settle();

    expect(table.columns.find((c) => c.key === 'supplier')!.visible).toBe(true);
    expect(status()).toBe('Supplier shown');
  });
});

describe('Moving a column without dragging (WCAG 2.5.7)', () => {
  it('moves a shown column down with its button, and announces the position', async () => {
    const table = await mount();

    await userEvent.click(button('Move Name down'));
    await settle();

    expect(order(table)).toEqual(['sku', 'warehouse', 'name', 'supplier', 'stock']);
    expect(items('Shown columns')).toEqual(['warehouse', 'name', 'stock']);
    expect(status()).toBe('Name, position 2 of 3');
  });

  it('moves past a hidden column to the next shown one', async () => {
    const table = await mount();

    await userEvent.click(button('Move Warehouse down'));
    await settle();

    expect(items('Shown columns')).toEqual(['name', 'stock', 'warehouse']);
    expect(order(table).indexOf('warehouse')).toBeGreaterThan(order(table).indexOf('stock'));
  });

  it('disables moving past either end', async () => {
    await mount();

    expect((button('Move Name up') as HTMLButtonElement).disabled).toBe(true);
    expect((button('Move In stock down') as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves with Alt and the arrow keys, keeping focus on the moved column (WCAG 2.1.1, 2.4.3 / RGAA 7.3, 12.8)', async () => {
    await mount();

    // Tab order: Move Name down, Hide column Name, Move Warehouse up.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('Move Warehouse up'));

    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await settle();

    expect(items('Shown columns')).toEqual(['warehouse', 'name', 'stock']);
    // Its up button is disabled now that it is first, so focus lands on its eye button.
    expect(document.activeElement).toBe(button('Hide column Warehouse'));
  });
});

describe('Dragging a column', () => {
  it('reorders within the shown list', async () => {
    const table = await mount();
    const stock = list('Shown columns').querySelector('li[data-key="stock"]')!;
    const name = list('Shown columns').querySelector('li[data-key="name"]')!;

    await userEvent.dragAndDrop(stock, name);
    await settle();

    expect(items('Shown columns')[0]).toBe('stock');
    expect(order(table).indexOf('stock')).toBeLessThan(order(table).indexOf('name'));
  });

  it('hides a column dropped on the hidden list', async () => {
    const table = await mount();
    const name = list('Shown columns').querySelector('li[data-key="name"]')!;

    await userEvent.dragAndDrop(name, list('Hidden columns'));
    await settle();

    expect(table.columns.find((c) => c.key === 'name')!.visible).toBe(false);
  });
});

describe('An empty list', () => {
  it('takes a column dropped on its hint', async () => {
    const table = await mount();
    await userEvent.click(
      list('Hidden columns').querySelector('li[data-key="supplier"] [data-control="eye"]'),
    );
    await settle();
    const hint = host.querySelector('.l-column-manager-hint')!;
    expect(hint).toBeTruthy();
    const name = list('Shown columns').querySelector('li[data-key="name"]')!;

    await userEvent.dragAndDrop(name, hint);
    await settle();

    expect(table.columns.find((c) => c.key === 'name')!.visible).toBe(false);
  });
});

describe('A column removed while it is dragged', () => {
  it('is dropped without an error and without a change', async () => {
    const table = await mount();
    const name = list('Shown columns').querySelector('li[data-key="name"]')!;
    name.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }),
    );
    table.querySelector('th[data-key="name"]')!.remove();
    await settle();
    const listener = vi.fn();
    table.addEventListener('column-change', listener);
    const errors = vi.fn();
    window.addEventListener('error', errors);

    list('Hidden columns').dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
    );
    await settle();
    window.removeEventListener('error', errors);

    expect(errors).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('Resetting the columns', () => {
  it('reports nothing when the columns already are the defaults', async () => {
    const table = await mount();
    const listener = vi.fn();
    table.addEventListener('column-change', listener);
    await userEvent.click(button('Reset columns'));
    await settle();
    expect(listener).not.toHaveBeenCalled();
  });

  it('restores the header’s defaults and forgets the stored ones', async () => {
    const table = await mount(MARKUP().replace('id="products"', 'id="products" persist-key="p"'));
    await userEvent.click(button('Hide column Name'));
    await settle();
    expect(localStorage.getItem('l-data-table:p')).not.toBeNull();

    await userEvent.click(button('Reset columns'));
    await settle();

    expect(table.columns.find((c) => c.key === 'name')!.visible).toBe(true);
    expect(localStorage.getItem('l-data-table:p')).toBeNull();
    expect(status()).toBe('Columns reset');
  });
});

describe('Accessibility', () => {
  describe('Announcements', () => {
    it('keeps its live region out of sight but in the accessibility tree', async () => {
      await mount();
      const region = host.querySelector<HTMLElement>('[role="status"]')!;

      expect(region.getBoundingClientRect().width).toBeLessThanOrEqual(1);
      expect(getComputedStyle(region).position).toBe('absolute');
      expect(getComputedStyle(region).display).not.toBe('none');
    });
  });

  describe('Roles and accessible names', () => {
    it('names every control after its column, in the page language (WCAG 4.1.2 / RGAA 7.1)', async () => {
      const previous = document.documentElement.lang;
      document.documentElement.lang = 'fr';
      await mount();

      expect(button('Masquer la colonne Name')).toBeTruthy();
      expect(button('Descendre Name')).toBeTruthy();
      expect(page.getByRole('list', { name: 'Colonnes affichées' }).element()).toBeTruthy();
      document.documentElement.lang = previous;
    });
  });
});

describe('The manager finds its table whenever it arrives', () => {
  const TABLE_ONLY = () => {
    const scratch = document.createElement('div');
    scratch.innerHTML = MARKUP();
    return scratch.querySelector('l-data-table')!;
  };

  it('lists the columns of a table inserted after it', async () => {
    host = document.createElement('div');
    host.innerHTML = '<l-column-manager for="products"></l-column-manager>';
    document.body.append(host);
    await customElements.whenDefined('l-column-manager');
    await settle();
    expect(host.querySelectorAll('li[data-key]')).toHaveLength(0);

    host.append(TABLE_ONLY());
    await settle();
    expect(items('Shown columns')).toEqual(['name', 'warehouse', 'stock']);
  });

  it('follows a new table rendered in place of the old one', async () => {
    const old = await mount();
    old.remove();
    const table = TABLE_ONLY() as DataTable;
    host.append(table);
    await settle();

    const next = waitForEvent(table, 'column-change') as Promise<ColumnChangeEvent>;
    await userEvent.click(
      list('Shown columns').querySelector('li[data-key="name"] [data-control="eye"]'),
    );
    expect((await next).columnVisibility.name).toBe(false);
  });
});
