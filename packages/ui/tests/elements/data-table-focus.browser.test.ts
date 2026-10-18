// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS imports below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cdp, page, server } from 'vite-plus/test/browser';
import '../../src/html/elements/data-table/index.js';
import type { DataTable } from '../../src/html/elements/data-table/data-table.js';
import { contrast, over, parse } from './support/contrast.js';
import { userEvent } from './support/user-event.js';

// The ring `<l-data-table navigable>` draws around a keyboard-focused row. The
// behaviour suite runs without the table's stylesheet on purpose; this one loads
// it, because what is under test is what a user sees.
import '../../src/css/preset.css';
import '../../src/css/elements/table/lines.css';
import '../../src/css/elements/table/grid.css';
import '../../src/css/elements/checkbox.css';
import '../../src/css/elements/data-table.css';

let host: HTMLElement;
afterEach(() => host?.remove());

async function mount(html: string) {
  host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  await customElements.whenDefined('l-data-table');
  const el = host.querySelector<DataTable>('l-data-table')!;
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  return el;
}

const ROW = (id: string, sku: string, { select = true } = {}) => `
  <tr>
    ${select ? `<td data-select><input type="checkbox" class="l-checkbox" value="${id}" aria-label="Select ${sku}"></td>` : ''}
    <th scope="row">${sku}</th>
    <td>Item ${id}</td>
    <td data-type="number">1${id.charCodeAt(0)}</td>
  </tr>`;

const TABLE = ({ select = true, attrs = 'selectable navigable' } = {}) => `
  <button type="button" id="before">Before</button>
  <l-data-table ${attrs}>
    <table class="l-table">
      <caption>Products</caption>
      <thead>
        <tr>
          ${select ? '<th scope="col" data-select></th>' : ''}
          <th scope="col" data-key="sku">SKU</th>
          <th scope="col" data-key="name">Name</th>
          <th scope="col" data-key="stock" data-type="number">Stock</th>
        </tr>
      </thead>
      <tbody>
        ${['a', 'b', 'c', 'd'].map((id, i) => ROW(id, `SKU-${i + 1}`, { select })).join('')}
      </tbody>
    </table>
  </l-data-table>`;

const rowAt = (i: number) => host.querySelectorAll<HTMLTableRowElement>('tbody > tr')[i];
const displayed = (tr: HTMLTableRowElement) =>
  [...tr.cells].filter((c) => getComputedStyle(c).display !== 'none');

/** Reach the second row from the keyboard: Tab into the body, then ↓. */
async function focusSecondRow() {
  // Start on the last control before the body: the header checkbox, if any.
  const start = host.querySelector<HTMLElement>('thead input');
  if (start) start.focus();
  else await userEvent.click(page.getByRole('button', { name: 'Before' }));
  await userEvent.keyboard('{Tab}{ArrowDown}');
  const tr = rowAt(1);
  expect(document.activeElement).toBe(tr);
  expect(tr.matches(':focus-visible')).toBe(true);
  return tr;
}

/** Splits a computed list value on its top-level commas. */
function layers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out;
}

/** The focus ring's colour as a solid gradient layer computes, read through a probe. */
function ringLayer(): string {
  const probe = document.createElement('div');
  probe.style.backgroundImage = 'linear-gradient(var(--l-focus-ring), var(--l-focus-ring))';
  host.append(probe);
  const value = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return value;
}

/**
 * The displayed cells of a row that paint part of the ring: a focus-ring layer
 * that isn't the 3 px start mark, or an overlay hosted on the cell.
 */
function ringedCells(tr: HTMLTableRowElement): HTMLTableCellElement[] {
  const ring = ringLayer();
  return displayed(tr).filter((c) => {
    const style = getComputedStyle(c);
    const images = layers(style.backgroundImage);
    const sizes = layers(style.backgroundSize);
    const painted = images.some((image, i) => image === ring && !sizes[i]?.startsWith('3px'));
    return painted || getComputedStyle(c, '::after').content !== 'none';
  });
}

describe('With navigable, a keyboard-focused row is ringed in every layout', () => {
  it('rings every visible cell of a keyboard-focused row (WCAG 2.4.7 / RGAA 10.7)', async () => {
    await mount(TABLE());

    const tr = await focusSecondRow();

    expect(ringedCells(tr)).toEqual(displayed(tr));
  });

  it('keeps the ring when the first plain column is hidden', async () => {
    const el = await mount(TABLE());
    el.columnVisibility = { sku: false };

    const tr = await focusSecondRow();

    expect(displayed(tr)).toHaveLength(3);
    expect(ringedCells(tr)).toEqual(displayed(tr));
  });

  it('keeps the ring when the first column is hidden too', async () => {
    const el = await mount(TABLE({ select: false }));
    el.columnVisibility = { sku: false };

    const tr = await focusSecondRow();

    expect(displayed(tr)).toHaveLength(2);
    expect(ringedCells(tr)).toEqual(displayed(tr));
  });
});

describe('The ring holds on sticky cells, in both appearances and right to left', () => {
  const STICKY_ROW = (id: string, sku: string) => `
    <tr>
      <td data-select data-sticky="start"><input type="checkbox" class="l-checkbox" value="${id}" aria-label="Select ${sku}"></td>
      <th scope="row" data-sticky="start">${sku}</th>
      <td>Item ${id}</td>
      <td data-type="number">12</td>
      <td data-sticky="end"><button type="button">Actions for ${sku}</button></td>
    </tr>`;
  /** A 900 px table in a 500 px scroller, scrolled sideways under its sticky cells. */
  const mountSticky = async ({ appearance = '', dir = 'ltr' } = {}) => {
    const el = await mount(`
      <button type="button" id="before">Before</button>
      <div dir="${dir}" class="scroller" style="inline-size: 500px; overflow: auto">
        <l-data-table selectable navigable>
          <table class="l-table" ${appearance && `data-appearance="${appearance}"`} style="inline-size: 900px">
            <caption>Products</caption>
            <thead>
              <tr>
                <th scope="col" data-select data-sticky="start"></th>
                <th scope="col" data-key="sku" data-sticky="start">SKU</th>
                <th scope="col" data-key="name">Name</th>
                <th scope="col" data-key="stock" data-type="number">Stock</th>
                <th scope="col" data-sticky="end" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>${['a', 'b', 'c'].map((id, i) => STICKY_ROW(id, `SKU-${i + 1}`)).join('')}</tbody>
          </table>
        </l-data-table>
      </div>`);
    const scroller = host.querySelector<HTMLElement>('.scroller')!;
    scroller.scrollLeft = dir === 'rtl' ? -300 : 300;
    return el;
  };
  const sticky = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('[data-sticky]')];

  for (const appearance of ['lines', 'grid']) {
    it(`rings sticky start and end cells too (${appearance})`, async () => {
      await mountSticky({ appearance });

      const tr = await focusSecondRow();

      expect(sticky(tr)).toHaveLength(3);
      expect(ringedCells(tr)).toEqual(displayed(tr));
    });
  }

  it('rings the row the same way in a right-to-left table', async () => {
    await mountSticky({ dir: 'rtl' });

    const tr = await focusSecondRow();

    expect(ringedCells(tr)).toEqual(displayed(tr));
    // The start mark (third layer) sits at the inline start: the right.
    const positions = layers(getComputedStyle(tr.cells[0]).backgroundPosition);
    expect(positions[2]).toMatch(/^100% /);
  });
});

describe('The ring stands out from the row it rings', () => {
  /** A token's colour as a `color-scheme` pane resolves it. */
  const token = (scheme: string, name: string) => {
    const probe = document.createElement('div');
    probe.style.colorScheme = scheme;
    probe.style.color = `var(${name})`;
    host.append(probe);
    const color = parse(getComputedStyle(probe).color);
    probe.remove();
    return color;
  };

  it('keeps the ring at 3:1 against the row, selected or not, in both schemes (WCAG 1.4.11 / RGAA 3.3)', async () => {
    await mount(TABLE());
    for (const scheme of ['light', 'dark']) {
      const surface = token(scheme, '--l-color-surface');
      for (const tint of ['--l-color-bg-state-hover', '--l-color-bg-state-selected']) {
        const row = over(token(scheme, tint), surface);
        const ring = over(token(scheme, '--l-focus-ring'), row);
        expect(contrast(ring, row), `${scheme}, ${tint}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('The focused row stays in view', () => {
  /** Presses each key in turn, checking the page after every one. */
  const pressEach = async (keys: string[], check: (key: string) => void): Promise<void> => {
    const [key, ...rest] = keys;
    if (key === undefined) return;
    await userEvent.keyboard(key);
    check(key);
    return pressEach(rest, check);
  };
  const mountScrolled = (rows: number, style: string) =>
    mount(`
      <div class="scroller" style="${style}; overflow: auto">
        <l-data-table navigable>
          <table class="l-table" style="inline-size: 900px">
            <caption>Products</caption>
            <thead>
              <tr>
                <th scope="col" data-key="sku">SKU</th>
                <th scope="col" data-key="name">Name</th>
                <th scope="col" data-key="stock" data-type="number">Stock</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: rows }, (_, i) => ROW(`r${i + 1}`, `SKU-${i + 1}`, { select: false })).join('')}
            </tbody>
          </table>
        </l-data-table>
      </div>`);
  const scroller = () => host.querySelector<HTMLElement>('.scroller')!;

  it('keeps the focused row clear of the sticky header when moving up (WCAG 2.4.11)', async () => {
    await mountScrolled(60, 'block-size: 300px');
    await userEvent.click(page.getByRole('cell', { name: 'Item r1', exact: true }));
    const header = host.querySelector('thead')!;

    const keys = ['{End}', ...Array.from({ length: 25 }, () => '{ArrowUp}'), '{PageUp}', '{Home}'];
    await pressEach(keys, (key) => {
      const row = (document.activeElement as HTMLElement).getBoundingClientRect();
      const box = scroller().getBoundingClientRect();
      if (key === '{End}') expect(scroller().scrollTop).toBeGreaterThan(0);
      expect(row.top, key).toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom - 1);
      expect(row.bottom, key).toBeLessThanOrEqual(box.bottom + 1);
    });
  });

  it('keeps the horizontal scroll position when moving between rows', async () => {
    await mountScrolled(4, 'inline-size: 500px');
    await userEvent.click(page.getByRole('cell', { name: 'Item r1', exact: true }));
    scroller().scrollLeft = 200;
    const before = scroller().scrollLeft;
    expect(before).toBeGreaterThan(0);

    await userEvent.keyboard('{ArrowDown}');

    expect(Math.abs(scroller().scrollLeft - before)).toBeLessThanOrEqual(1);
  });
});

describe('In forced colors, the focused row is outlined instead', () => {
  const emulate = (value: 'active' | 'none') =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value }] });

  afterEach(async () => {
    if (server.browser === 'chromium') await emulate('none');
  });

  // Forced colors drop background images, ring layers included. Only Chromium
  // can emulate the mode; a real Windows High Contrast check is manual.
  it.skipIf(server.browser !== 'chromium')(
    "outlines the focused row's visible cells in forced colors, with a column hidden",
    async () => {
      const el = await mount(TABLE());
      el.columnVisibility = { sku: false };
      await emulate('active');
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);

      const tr = await focusSecondRow();

      for (const cell of displayed(tr)) {
        const style = getComputedStyle(cell);
        expect([style.outlineStyle, style.outlineWidth]).toEqual(['solid', '2px']);
      }
    },
  );
});
