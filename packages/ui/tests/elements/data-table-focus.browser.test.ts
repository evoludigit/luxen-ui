// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS imports below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cdp, page, server } from 'vite-plus/test/browser';
import '../../src/html/elements/data-table/index.js';
import type { DataTable } from '../../src/html/elements/data-table/data-table.js';
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

/** Reach the second row from the keyboard alone: Tab into the body, then ↓. */
async function focusSecondRow() {
  await userEvent.click(page.getByRole('button', { name: 'Before' }));
  // Past the header checkbox, when there is one, onto the body's tab stop.
  await userEvent.keyboard(host.querySelector('thead input') ? '{Tab}{Tab}' : '{Tab}');
  await userEvent.keyboard('{ArrowDown}');
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
