import { describe, expect, it } from 'vite-plus/test';
import '../../src/css/tokens.css';
import '../../src/css/elements/board.css';

// Asserts what is painted before and after the upgrade, so it pulls in the
// tokens and the opt-in sheet, and defines the elements only halfway through.
// Its own file, so the elements are still undefined when it starts.

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

function boxes(host: HTMLElement) {
  return [...host.querySelectorAll('l-board, l-board-list, l-board-item')].map((el) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return { tag: el.localName, x, y, width, height };
  });
}

describe('A board before its elements load', () => {
  it('takes the place it takes once they have', async () => {
    const host = document.createElement('div');
    host.style.inlineSize = '40rem';
    host.innerHTML = `
      <l-board label="Price tiers">
        <l-board-list label="Unpriced" value="unpriced">
          <l-board-item value="lamp">Desk lamp</l-board-item>
          <l-board-item value="chair">Office chair</l-board-item>
          <l-board-item value="tray">Cable tray</l-board-item>
        </l-board-list>
        <l-board-list label="Standard" value="standard">
          <l-board-item value="notebook">Notebook</l-board-item>
          <button slot="footer" type="button">Add a product</button>
        </l-board-list>
        <l-board-list label="Premium" value="premium"></l-board-list>
      </l-board>`;
    document.body.append(host);

    try {
      expect(customElements.get('l-board')).toBeUndefined();
      const before = boxes(host);

      await import('../../src/html/elements/board/index.js');
      await import('../../src/html/elements/board-list/index.js');
      await import('../../src/html/elements/board-item/index.js');
      await nextFrame();
      await nextFrame();
      const after = boxes(host);

      for (const [i, box] of after.entries()) {
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(before[i][key], `${box.tag} #${i} ${key}`).toBeCloseTo(box[key], 0);
        }
      }
    } finally {
      host.remove();
    }
  });
});
