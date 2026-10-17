// oxlint-disable-next-line typescript/triple-slash-reference -- ambient *.css module for the side-effect CSS import below.
/// <reference path="./a11y/a11y-env.d.ts" />
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';
import { userEvent } from './support/user-event.js';

// `.l-pagination` ships no JavaScript: a page is a link, the URL is the state,
// the current page is `aria-current="page"`, and a step that leads nowhere is a
// link without `href`, which the browser already leaves out of the tab order.
// What is under test is that the stylesheet keeps all of that usable.
import '../../src/css/preset.css';
import '../../src/css/elements/pagination.css';

let host: HTMLElement;
afterEach(() => {
  host?.remove();
  history.replaceState(null, '', location.pathname + location.search);
});

function mount(html: string) {
  host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

const PAGINATION = ({
  previous = '<a href="#page-1" data-step="previous">Previous</a>',
  range = true,
} = {}) => `
  <a href="#before" id="before">before</a>
  <nav class="l-pagination" aria-label="Pagination">
    ${range ? '<p>51–100 of 1,284</p>' : ''}
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

const link = (name: string) =>
  page.getByRole('link', { name, exact: true }).element() as HTMLElement;
const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);

describe('A pagination is a navigation of links', () => {
  it('is a named navigation landmark with the current page marked', async () => {
    mount(PAGINATION());

    expect(await page.getByRole('navigation', { name: 'Pagination' }).query()).toBeTruthy();
    expect(link('2').getAttribute('aria-current')).toBe('page');
  });

  it('follows a page link like any link', async () => {
    mount(PAGINATION());

    await userEvent.click(link('3'));

    expect(location.hash).toBe('#page-3');
  });

  it('sets the current page apart by more than color', () => {
    mount(PAGINATION());

    expect(style(link('2')).backgroundColor).not.toBe(style(link('3')).backgroundColor);
    expect(Number(style(link('2')).fontWeight)).toBeGreaterThan(
      Number(style(link('3')).fontWeight),
    );
  });

  it('shows the range in a quieter text color', () => {
    mount(PAGINATION());

    const nav = host.querySelector('nav')!;
    expect(style(nav.querySelector('p')!).color).not.toBe(style(nav).color);
  });
});

describe('Steps', () => {
  it('draws a direction glyph on the previous and next steps', () => {
    mount(PAGINATION());

    expect(style(link('Previous'), '::before').content).not.toBe('none');
    expect(style(link('Next'), '::after').content).not.toBe('none');
  });

  it('flips the glyphs in a right-to-left page', () => {
    mount(`<div dir="rtl">${PAGINATION()}</div>`);

    expect(style(link('Next'), '::after').scale).toBe('-1 1');
  });

  it('greys out a step without href and leaves it out of the tab order (WCAG 2.1.1 / RGAA 7.3)', async () => {
    mount(PAGINATION({ previous: '<a data-step="previous" aria-disabled="true">Previous</a>' }));
    const disabled = host.querySelector<HTMLElement>('[data-step="previous"]')!;

    expect(style(disabled).color).not.toBe(style(link('3')).color);
    expect(style(disabled).cursor).toBe('default');

    await userEvent.click(link('before'));
    await userEvent.tab();
    expect(document.activeElement).toBe(link('1'));
  });
});

describe('Accessibility', () => {
  describe('Roles and accessible names', () => {
    it('lists the pages in order, the gap marker left out (WCAG 1.3.1 / RGAA 9.3)', async () => {
      mount(PAGINATION());

      expect(await page.getByRole('list').query()).toBeTruthy();
      expect(page.getByRole('listitem').elements()).toHaveLength(6);
    });
  });

  describe('Keyboard interaction', () => {
    it('reaches every page link with Tab and follows it with Enter (WCAG 2.1.1 / RGAA 7.3)', async () => {
      mount(PAGINATION());

      await userEvent.click(link('before'));
      await userEvent.tab();
      await userEvent.tab();
      expect(document.activeElement).toBe(link('1'));
      await userEvent.keyboard('{Enter}');
      expect(location.hash).toBe('#page-1');
    });
  });

  describe('Focus management', () => {
    it('draws the Luxen focus ring on a focused link (WCAG 2.4.7 / RGAA 10.7)', async () => {
      mount(PAGINATION());

      await userEvent.click(link('before'));
      await userEvent.tab();

      expect(style(document.activeElement!).outlineStyle).toBe('solid');
    });

    it('gives every link a target of at least 24 by 24 pixels (WCAG 2.5.8)', () => {
      mount(PAGINATION());

      for (const a of host.querySelectorAll('nav a')) {
        const r = a.getBoundingClientRect();
        expect(r.width).toBeGreaterThanOrEqual(24);
        expect(r.height).toBeGreaterThanOrEqual(24);
      }
    });
  });
});
