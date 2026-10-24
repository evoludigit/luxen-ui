import { describe, expect, it } from 'vite-plus/test';
import '../../src/html/elements/board/index.js';
import '../../src/html/elements/board-list/index.js';
import type { BoardList } from '../../src/html/elements/board-list/board-list.js';

// A page may define the elements in any order: the docs import the board, then
// its lists, then its items. Its own file, so `l-board-item` is still
// undefined when the lists first render.

describe('A list whose items are defined after it', () => {
  it('shows its items', async () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <l-board label="Price tiers">
        <l-board-list label="Unpriced" value="unpriced">
          <l-board-item value="lamp">Desk lamp</l-board-item>
          <div><l-board-item value="chair">Office chair</l-board-item></div>
        </l-board-list>
      </l-board>`;
    document.body.append(host);
    const list = host.querySelector<BoardList>('l-board-list')!;
    await list.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));

    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener('error', onError);

    try {
      expect(customElements.get('l-board-item')).toBeUndefined();
      expect(list.items).toEqual([]);
      // The board syncs on a change made before the items upgrade.
      list.setAttribute('label', 'Not priced');
      await new Promise((r) => setTimeout(r, 0));
      expect(errors).toEqual([]);

      await import('../../src/html/elements/board-item/index.js');
      await new Promise((r) => requestAnimationFrame(r));

      const placeholder = list.shadowRoot!.querySelector<HTMLElement>('[part="placeholder"]')!;
      expect(placeholder.checkVisibility()).toBe(false);
      for (const item of host.querySelectorAll('l-board-item')) {
        expect(item.checkVisibility()).toBe(true);
      }
      expect(list.items.map((i) => i.value)).toEqual(['lamp', 'chair']);
    } finally {
      window.removeEventListener('error', onError);
      host.remove();
    }
  });
});
