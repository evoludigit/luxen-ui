import { defineA11yFixture } from '../../support/a11y-fixture.js';
import { openOverlay } from './_open.js';

// l-board: a named group of named list groups, each holding a role="list"
// of role="listitem" chips. Every chip carries a "Move to…" menu button named
// after it; the open menu, the empty-list placeholder, a disabled item and a
// disabled list are all part of what a user meets.
const MARKUP = `
  <l-board label="Price tiers" style="--show-duration: 0; --hide-duration: 0">
    <l-board-list label="Unpriced">
      <l-board-item value="lamp">Desk lamp</l-board-item>
      <l-board-item value="chair" disabled>Office chair</l-board-item>
    </l-board-list>
    <l-board-list label="Standard">
      <strong slot="header">Standard · 4.90</strong>
      <l-board-item value="notebook">Notebook</l-board-item>
      <button slot="footer" type="button">Add a product</button>
    </l-board-list>
    <l-board-list label="Premium"></l-board-list>
    <l-board-list label="Archived" disabled></l-board-list>
  </l-board>`;

export default defineA11yFixture({
  name: 'board',
  covers: ['board-list', 'board-item'],
  states: {
    default: MARKUP,
    'menu open': {
      html: MARKUP,
      setup: async (host) => {
        const item = host.querySelector('l-board-item')!;
        await openOverlay(item.shadowRoot!.querySelector('.menu')!);
      },
    },
  },
});
