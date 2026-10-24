import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';
import '../../src/html/elements/board/index.js';
import '../../src/html/elements/board-list/index.js';
import '../../src/html/elements/board-item/index.js';
import '../../src/html/translations/fr.js';
import type { Board, MoveRequestEvent } from '../../src/html/elements/board/board.js';
import { move } from '../../src/html/elements/board/board-state.js';
import { BoardItem } from '../../src/html/elements/board-item/board-item.js';
import type { BoardList } from '../../src/html/elements/board-list/board-list.js';
import type { DropdownSelectEvent } from '../../src/html/elements/dropdown/dropdown.js';
import { userEvent } from './support/user-event.js';
import { deepActiveElement } from './support/a11y.js';

// <l-board> groups <l-board-list>s of <l-board-item>s. Dragging an item to
// another list, or choosing one in its "Move to…" menu, only *requests* the
// move: the page applies it in its own data, or not. The board then announces
// the moves that actually happened. Shadow DOM; the items stay page-owned.

let host: HTMLElement;
let requests: MoveRequestEvent[];

afterEach(() => host?.remove());

// Chromium and Firefox both have `ariaNotify()`, which leaves nothing in the
// page to read back. These tests read the live region the board falls back to,
// so they run without it; the `ariaNotify()` path is stubbed where it is tested.
type Notifier = { ariaNotify?: (message: string) => void };
const nativeAriaNotify = Object.getOwnPropertyDescriptor(Element.prototype, 'ariaNotify');
beforeEach(() => {
  delete (Element.prototype as Notifier).ariaNotify;
});
afterEach(() => {
  if (nativeAriaNotify) Object.defineProperty(Element.prototype, 'ariaNotify', nativeAriaNotify);
  else delete (Element.prototype as Notifier).ariaNotify;
});

const MARKUP = `
  <l-board label="Price tiers">
    <l-board-list label="Unpriced" value="unpriced">
      <l-board-item value="lamp">Desk lamp</l-board-item>
      <l-board-item value="chair">Office chair</l-board-item>
    </l-board-list>
    <l-board-list label="Standard" value="standard">
      <l-board-item value="notebook">Notebook</l-board-item>
    </l-board-list>
    <l-board-list label="Premium" value="premium"></l-board-list>
  </l-board>`;

async function mount(markup = MARKUP) {
  host = document.createElement('div');
  // No menu animation, so a test never waits on one.
  host.style.cssText = '--show-duration: 0; --hide-duration: 0';
  host.innerHTML = markup;
  document.body.append(host);
  requests = [];
  host.addEventListener('move-request', (e) => requests.push(e));
  await customElements.whenDefined('l-board-item');
  await settle();
  return host.querySelector<Board>('l-board')!;
}

async function settle() {
  const elements = host.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>(
    'l-board, l-board-list, l-board-item',
  );
  await Promise.all([...elements].map((el) => el.updateComplete));
  // The board watches its lists with a MutationObserver (a microtask), the
  // menus open on the next frame, and the live region is filled two frames
  // after it is cleared.
  await nextFrame();
  await nextFrame();
  await new Promise((r) => setTimeout(r, 0));
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

/** The page's side of the contract: apply every request it receives. */
function applyRequests({ recreate = false, delay = 0 } = {}) {
  host.addEventListener('move-request', (e) => {
    const apply = () => {
      if (!recreate) {
        e.to.append(e.item);
        return;
      }
      // What a framework that keys each list's items does: the old element goes,
      // a new one with the same value arrives in the other list.
      const next = document.createElement('l-board-item');
      next.setAttribute('value', e.value);
      next.textContent = e.item.textContent;
      e.item.remove();
      e.to.append(next);
    };
    if (delay) setTimeout(apply, delay);
    else apply();
  });
}

const list = (label: string) => host.querySelector<BoardList>(`l-board-list[label="${label}"]`)!;
const item = (value: string) => host.querySelector<BoardItem>(`l-board-item[value="${value}"]`)!;
const values = (label: string) =>
  [...list(label).querySelectorAll<BoardItem>('l-board-item')].map((i) => i.value);
const moveButton = (label: string) =>
  page.getByRole('button', { name: `Move ${label} to…`, exact: true });
const menuItems = () =>
  page
    .getByRole('menuitem')
    .elements()
    .filter((el: Element) => el.checkVisibility())
    // The menuitem row lives in the dropdown item's shadow root; its label is
    // the item's slotted text.
    .map((el: Element) => ((el.getRootNode() as ShadowRoot).host.textContent ?? '').trim());
// Every item has its own menu. WebKit's role query also returns the items of
// the closed ones, so the open menu is told apart by what is rendered.
const menuItem = (name: string) =>
  page
    .getByRole('menuitem', { name })
    .elements()
    .find((el: Element) => el.checkVisibility())!;
/**
 * The drag marks set and cleared during `gesture`, in order, as `name:attr:+`
 * or `name:attr:-`. `dragAndDrop` plays the whole gesture in one step, so the
 * marks are read from the mutations it leaves behind.
 */
async function marksDuring(gesture: () => Promise<unknown>) {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(host, {
    subtree: true,
    attributeOldValue: true,
    attributeFilter: ['data-dragging', 'data-drop-target'],
  });
  await gesture();
  await settle();
  records.push(...observer.takeRecords());
  observer.disconnect();
  return records.map((r) => {
    const el = r.target as HTMLElement;
    const name =
      el.localName === 'l-board-item' ? el.getAttribute('value') : el.getAttribute('label');
    return `${name}:${r.attributeName}:${r.oldValue === null ? '+' : '-'}`;
  });
}
const status = () => (page.getByRole('status').element().textContent ?? '').trim();
const placeholder = (label: string) =>
  list(label).shadowRoot!.querySelector<HTMLElement>('[part="placeholder"]');

describe('Dragging an item to another list', () => {
  it('requests the move, with the item, its value and both lists', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.item).toBe(item('lamp'));
    expect(request.value).toBe('lamp');
    expect(request.from).toBe(list('Unpriced'));
    expect(request.to).toBe(list('Standard'));
  });

  it('names both lists and both positions in the request', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    const [request] = requests;
    expect(request.from.value).toBe('unpriced');
    expect(request.to.value).toBe('standard');
    expect(request.fromIndex).toBe(0);
    expect(request.index).toBe(list('Standard').items.length);
  });

  it('moves nothing by itself', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(values('Unpriced')).toEqual(['lamp', 'chair']);
    expect(values('Standard')).toEqual(['notebook']);
  });

  it('requests nothing when the item is dropped on its own list', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), item('chair'));
    await settle();

    expect(requests).toHaveLength(0);
  });

  it('takes a drop on the placeholder of an empty list', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), placeholder('Premium')!);
    await settle();

    expect(requests.map((r) => r.to)).toEqual([list('Premium')]);
  });

  it('marks the dragged item and the list it is over, then clears both', async () => {
    await mount();

    const marks = await marksDuring(() => userEvent.dragAndDrop(item('lamp'), list('Standard')));

    expect(marks).toContain('lamp:data-dragging:+');
    expect(marks).toContain('Standard:data-drop-target:+');
    expect(marks).not.toContain('Unpriced:data-drop-target:+');
    expect(item('lamp').hasAttribute('data-dragging')).toBe(false);
    expect(list('Standard').hasAttribute('data-drop-target')).toBe(false);
  });

  it('does not offer its own list as a drop target', async () => {
    await mount();

    const marks = await marksDuring(() => userEvent.dragAndDrop(item('lamp'), item('chair')));

    expect(marks).toContain('lamp:data-dragging:+');
    expect(marks).not.toContain('Unpriced:data-drop-target:+');
  });

  it('drops nothing into a text field', async () => {
    await mount(`<input aria-label="Notes" />${MARKUP}`);
    const notes = page.getByRole('textbox', { name: 'Notes' }).element() as HTMLInputElement;

    await userEvent.dragAndDrop(item('lamp'), notes);
    await settle();

    expect(notes.value).toBe('');
  });

  it('ignores an item dragged from another board', async () => {
    await mount(
      MARKUP +
        `<l-board label="Other">
          <l-board-list label="Elsewhere"><l-board-item value="pen">Pen</l-board-item></l-board-list>
        </l-board>`,
    );

    await userEvent.dragAndDrop(item('pen'), list('Standard'));
    await settle();

    expect(requests).toHaveLength(0);
  });
});

describe('Moving an item without dragging (WCAG 2.5.7 / RGAA 7.1)', () => {
  it('gives every item a "Move to…" button named after it', async () => {
    await mount();

    expect(moveButton('Desk lamp').elements()).toHaveLength(1);
    expect(moveButton('Notebook').elements()).toHaveLength(1);
  });

  it('lists the board’s other lists in the menu', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard', 'Premium']);
  });

  it('requests the move to the list chosen in the menu', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Premium'));
    await settle();

    expect(requests).toHaveLength(1);
    expect(requests[0].value).toBe('lamp');
    expect(requests[0].from).toBe(list('Unpriced'));
    expect(requests[0].to).toBe(list('Premium'));
    expect(values('Unpriced')).toEqual(['lamp', 'chair']);
  });

  it('requests the same move from the menu, with both positions', async () => {
    await mount();

    await userEvent.click(moveButton('Office chair'));
    await settle();
    await userEvent.click(menuItem('Premium'));
    await settle();

    expect(requests).toHaveLength(1);
    expect(requests[0].from.value).toBe('unpriced');
    expect(requests[0].to.value).toBe('premium');
    expect(requests[0].fromIndex).toBe(1);
    expect(requests[0].index).toBe(0);
  });

  it('offers the moved item the lists it is no longer in', async () => {
    await mount();
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();
    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Unpriced', 'Standard']);
  });

  it('follows a list renamed by the page', async () => {
    await mount();

    list('Premium').setAttribute('label', 'Luxury');
    await settle();
    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard', 'Luxury']);
  });

  it('renames the move button when the item’s text changes', async () => {
    await mount();

    // What a framework does for `{{ product.name }}`: it rewrites the text node.
    item('lamp').firstChild!.textContent = 'Floor lamp';
    await settle();

    expect(moveButton('Floor lamp').elements()).toHaveLength(1);
    expect(moveButton('Desk lamp').elements()).toHaveLength(0);
  });

  it('builds no menu until it is opened', async () => {
    await mount();

    const entries = () =>
      [...host.querySelectorAll('l-board-item')].flatMap((i) =>
        Array.from(i.shadowRoot!.querySelectorAll('l-dropdown-item')),
      );
    expect(entries()).toEqual([]);

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    expect(menuItems()).toEqual(['Standard', 'Premium']);

    await userEvent.keyboard('{Escape}');
    await settle();
    expect(entries()).toEqual([]);
  });

  it('offers the current lists when reopened after a rename', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.keyboard('{Escape}');
    await settle();
    list('Premium').setAttribute('label', 'Luxury');
    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard', 'Luxury']);
  });

  it('follows a list renamed while the menu is open', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    list('Premium').setAttribute('label', 'Luxury');
    await settle();

    expect(menuItems()).toEqual(['Standard', 'Luxury']);
  });

  it('disables the move button once the last other list is disabled', async () => {
    await mount(`
      <l-board label="Tiers">
        <l-board-list label="Open"><l-board-item value="lamp">Desk lamp</l-board-item></l-board-list>
        <l-board-list label="Closed"></l-board-list>
      </l-board>`);

    list('Closed').disabled = true;
    await settle();

    expect(moveButton('Desk lamp').element()).toHaveProperty('disabled', true);
  });

  it('reflects the item’s label', async () => {
    await mount();

    item('lamp').label = 'Lamp, brass';
    await settle();

    expect(item('lamp').getAttribute('label')).toBe('Lamp, brass');
  });

  it('uses `label` over the item’s text when it is set', async () => {
    await mount(MARKUP.replace('value="lamp"', 'value="lamp" label="Lamp, brass"'));

    expect(moveButton('Lamp, brass').elements()).toHaveLength(1);
  });
});

describe('The page’s own actions in the menu', () => {
  const ACTIONS = MARKUP.replace(
    '<l-board-item value="lamp">Desk lamp</l-board-item>',
    `<l-board-item value="lamp">Desk lamp<l-dropdown-item slot="actions" value="edit"
      >Edit</l-dropdown-item><l-dropdown-item slot="actions" value="remove">Remove</l-dropdown-item></l-board-item>`,
  );

  it('adds the page’s actions below the lists', async () => {
    await mount(ACTIONS);

    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard', 'Premium', 'Edit', 'Remove']);
  });

  it('separates them from the lists', async () => {
    await mount(ACTIONS);

    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    const separators = page
      .getByRole('separator')
      .elements()
      .filter((el: Element) => el.checkVisibility());
    expect(separators).toHaveLength(1);
  });

  it('draws no separator for an item without actions', async () => {
    await mount(ACTIONS);

    await userEvent.click(moveButton('Office chair'));
    await settle();

    expect(
      page
        .getByRole('separator')
        .elements()
        .filter((el: Element) => el.checkVisibility()),
    ).toHaveLength(0);
  });

  it('hands a chosen action to the page as the dropdown’s `select`, and requests no move', async () => {
    await mount(ACTIONS);
    const chosen: string[] = [];
    item('lamp').addEventListener('select', (e) =>
      chosen.push((e as DropdownSelectEvent).item.value),
    );

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Edit'));
    await settle();

    expect(chosen).toEqual(['edit']);
    expect(requests).toHaveLength(0);
  });

  it('reaches them with the keyboard', async () => {
    await mount(ACTIONS);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(deepActiveElement()).toBe(menuItem('Remove'));

    await userEvent.keyboard('{ArrowUp}');
    expect(deepActiveElement()).toBe(menuItem('Edit'));
    await userEvent.keyboard('{ArrowUp}');
    expect(deepActiveElement()).toBe(menuItem('Premium'));
  });

  it('keeps them out of the item’s name', async () => {
    await mount(ACTIONS);
    applyRequests();

    expect(moveButton('Desk lamp').elements()).toHaveLength(1);
    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();
    expect(status()).toBe('Desk lamp moved to Premium');
  });
});

describe('The page applies the move', () => {
  it('announces the move once the page has made it', async () => {
    await mount();
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(values('Standard')).toEqual(['notebook', 'lamp']);
    expect(status()).toBe('Desk lamp moved to Standard');
  });

  it('announces a move the page makes later, after its own dialog say', async () => {
    await mount();
    applyRequests({ delay: 50 });

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();
    expect(status()).toBe('');

    await new Promise((r) => setTimeout(r, 80));
    await settle();
    expect(status()).toBe('Desk lamp moved to Standard');
  });

  it('announces a move made with a new element of the same value', async () => {
    await mount();
    applyRequests({ recreate: true });

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(values('Premium')).toEqual(['lamp']);
    expect(status()).toBe('Desk lamp moved to Premium');
  });

  it('announces nothing when the page ignores the request', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(status()).toBe('');
  });

  it('announces nothing for a move the user did not ask for', async () => {
    await mount();

    list('Premium').append(item('chair'));
    await settle();

    expect(status()).toBe('');
  });

  it('announces nothing when the page moves, later and for its own reason, an item whose request it ignored', async () => {
    await mount(`<button>Outside</button>${MARKUP}`);
    const outside = page.getByRole('button', { name: 'Outside' }).element();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Standard'));
    await settle();
    await userEvent.click(outside);
    // A refresh from the server, say, puts the item in a list of its own choice.
    list('Premium').append(item('lamp'));
    await settle();

    expect(status()).toBe('');
    expect(deepActiveElement()).toBe(outside);
  });

  it('leaves focus alone when an ignored request is fulfilled late', async () => {
    await mount(`<button>Outside</button>${MARKUP}`);
    const outside = page.getByRole('button', { name: 'Outside' }).element();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Standard'));
    await settle();
    await userEvent.click(outside);
    list('Standard').append(item('lamp'));
    await settle();

    expect(deepActiveElement()).toBe(outside);
  });

  it('leaves focus on the page when the page moves an item elsewhere than requested', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Standard'));
    await settle();
    (deepActiveElement() as HTMLElement).blur();
    list('Premium').append(item('lamp'));
    await settle();

    expect(document.activeElement).toBe(document.body);
  });

  it('forgets an ignored request once the user makes another', async () => {
    await mount();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await userEvent.dragAndDrop(item('chair'), list('Premium'));
    await settle();
    list('Standard').append(item('lamp'));
    await settle();

    expect(status()).toBe('');
  });

  it('forgets a request the page has not applied within 10 seconds', async () => {
    await mount();
    const now = performance.now();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(now);

    try {
      await userEvent.dragAndDrop(item('lamp'), list('Standard'));
      await settle();
      clock.mockReturnValue(now + 10_001);
      list('Standard').append(item('lamp'));
      await settle();
    } finally {
      clock.mockRestore();
    }

    expect(status()).toBe('');
  });

  it('announces nothing for items without a value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await mount(MARKUP.replace(' value="lamp"', '').replace(' value="chair"', ''));
      const [lamp, chair] = list('Unpriced').items;

      await userEvent.dragAndDrop(lamp, list('Standard'));
      await settle();
      list('Standard').append(chair);
      await settle();

      expect(status()).toBe('');
    } finally {
      warn.mockRestore();
    }
  });

  it('warns about an empty or duplicate value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await mount(MARKUP.replace(' value="lamp"', '').replace('value="notebook"', 'value="chair"'));
      // Another sync must not warn twice about the same item.
      list('Premium').setAttribute('label', 'Luxury');
      await settle();

      const messages = warn.mock.calls.map((args: unknown[]) => String(args[0]));
      expect(messages).toHaveLength(2);
      expect(messages[0]).toContain('"Desk lamp" has no value');
      expect(messages[1]).toContain('"Notebook" has the value "chair" of another item');
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn about an item a framework renders with a `value` property', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await mount();
      host.addEventListener('move-request', (e) => {
        // Vue sets a property, not an attribute, on an element it knows.
        const next = document.createElement('l-board-item') as BoardItem;
        next.value = e.value;
        next.textContent = e.item.textContent;
        e.item.remove();
        e.to.append(next);
      });

      await userEvent.dragAndDrop(item('lamp'), list('Premium'));
      await settle();

      expect(warn).not.toHaveBeenCalled();
      expect(status()).toBe('Desk lamp moved to Premium');
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps focus on the moved item when it was moved from its menu (WCAG 2.4.3 / RGAA 12.8)', async () => {
    await mount();
    applyRequests({ recreate: true });

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Standard'));
    await settle();

    expect(deepActiveElement()).toBe(moveButton('Desk lamp').element());
    expect(list('Standard').contains(item('lamp'))).toBe(true);
  });
});

describe('The board’s state', () => {
  it('reports its state in list order', async () => {
    const board = await mount();

    expect(board.state).toEqual({
      unpriced: ['lamp', 'chair'],
      standard: ['notebook'],
      premium: [],
    });
    expect(Object.keys(board.state)).toEqual(['unpriced', 'standard', 'premium']);
  });

  it('leaves out lists without a value', async () => {
    const board = await mount(MARKUP.replace(' value="premium"', ''));

    expect(Object.keys(board.state)).toEqual(['unpriced', 'standard']);
  });

  it('follows the page’s moves', async () => {
    const board = await mount();
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(board.state.premium).toEqual(['lamp']);
  });

  it('is changed by a request the way move() applies it', async () => {
    const board = await mount();
    const before = board.state;
    applyRequests();

    await userEvent.dragAndDrop(item('chair'), list('Standard'));
    await settle();

    expect(move(before, requests[0])).toEqual(board.state);
  });
});

describe('An empty list', () => {
  it('shows a "Drop here" placeholder', async () => {
    await mount();

    expect(placeholder('Premium')?.checkVisibility()).toBe(true);
    expect(placeholder('Premium')?.textContent?.trim()).toBe('Drop here');
    expect(placeholder('Standard')?.checkVisibility() ?? false).toBe(false);
  });

  it('hides the placeholder once an item arrives', async () => {
    await mount();
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(placeholder('Premium')?.checkVisibility() ?? false).toBe(false);
  });

  it('shows it again when its last item leaves', async () => {
    await mount();
    applyRequests();

    await userEvent.dragAndDrop(item('notebook'), list('Premium'));
    await settle();

    expect(placeholder('Standard')?.checkVisibility()).toBe(true);
  });
});

describe('A list’s own empty state', () => {
  const EMPTY = MARKUP.replace(
    '<l-board-list label="Premium" value="premium"></l-board-list>',
    '<l-board-list label="Premium" value="premium"><span slot="empty">No models yet</span></l-board-list>',
  );

  it('shows the page’s own empty state in place of "Drop here"', async () => {
    await mount(EMPTY);

    expect(page.getByText('No models yet').element().checkVisibility()).toBe(true);
    expect(placeholder('Premium')?.checkVisibility()).toBe(true);
    // `innerText` is the rendered text: the slotted state, not the fallback.
    expect(placeholder('Premium')?.innerText.trim()).toBe('');
  });

  it('still takes drops', async () => {
    await mount(EMPTY);

    await userEvent.dragAndDrop(item('lamp'), page.getByText('No models yet').element());
    await settle();

    expect(requests.map((r) => r.to)).toEqual([list('Premium')]);
  });

  it('hides it once an item arrives', async () => {
    await mount(EMPTY);
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(page.getByText('No models yet').element().checkVisibility()).toBe(false);
  });
});

describe('Items the page wraps in an element', () => {
  // What Vue's <TransitionGroup tag="div"> renders inside each list.
  const WRAPPED = `
    <l-board label="Price tiers">
      <l-board-list label="Unpriced"><div><l-board-item value="lamp">Desk lamp</l-board-item></div></l-board-list>
      <l-board-list label="Premium"><div></div></l-board-list>
    </l-board>`;

  it('shows items the page wraps in an element', async () => {
    await mount(WRAPPED);

    expect(item('lamp').checkVisibility()).toBe(true);
    expect(placeholder('Unpriced')?.checkVisibility() ?? false).toBe(false);
    expect(list('Unpriced').items).toEqual([item('lamp')]);
  });

  it('shows the placeholder of a list whose wrapper holds no item', async () => {
    await mount(WRAPPED);

    expect(placeholder('Premium')?.checkVisibility()).toBe(true);
  });

  it('announces the move of a wrapped item', async () => {
    await mount(WRAPPED);
    host.addEventListener('move-request', (e) => e.to.querySelector('div')!.append(e.item));

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(status()).toBe('Desk lamp moved to Premium');
    expect(placeholder('Premium')?.checkVisibility() ?? false).toBe(false);
    expect(placeholder('Unpriced')?.checkVisibility()).toBe(true);
  });
});

describe('A disabled item', () => {
  const DISABLED = MARKUP.replace('value="chair"', 'value="chair" disabled');

  it('cannot be dragged', async () => {
    await mount(DISABLED);

    expect(item('chair').draggable).toBe(false);
    await userEvent.dragAndDrop(item('chair'), list('Standard'));
    await settle();
    expect(requests).toHaveLength(0);
  });

  it('has a disabled move button', async () => {
    await mount(DISABLED);

    expect(moveButton('Office chair').element()).toHaveProperty('disabled', true);
  });

  it('can be moved again once enabled', async () => {
    await mount(DISABLED);

    item('chair').disabled = false;
    await settle();

    expect(item('chair').draggable).toBe(true);
    expect(moveButton('Office chair').element()).toHaveProperty('disabled', false);
  });
});

describe('A disabled list', () => {
  const DISABLED = MARKUP.replace('label="Premium"', 'label="Premium" disabled');

  it('accepts no drop', async () => {
    await mount(DISABLED);

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(requests).toHaveLength(0);
  });

  it('shows no placeholder', async () => {
    await mount(DISABLED);

    expect(placeholder('Premium')?.checkVisibility() ?? false).toBe(false);
  });

  it('is left out of the "Move to…" menus', async () => {
    await mount(DISABLED);

    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard']);
  });

  it('lets its own items leave', async () => {
    await mount(DISABLED.replace('label="Unpriced"', 'label="Unpriced" disabled'));

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(requests.map((r) => r.value)).toEqual(['lamp']);
  });

  it('disables the move button of an item with nowhere to go', async () => {
    await mount(`
      <l-board label="Tiers">
        <l-board-list label="Open"><l-board-item value="lamp">Desk lamp</l-board-item></l-board-list>
        <l-board-list label="Closed" disabled></l-board-list>
      </l-board>`);

    expect(moveButton('Desk lamp').element()).toHaveProperty('disabled', true);
  });
});

describe('A list with drop rules (`canDrop`)', () => {
  it('refuses a drop the list’s canDrop rejects', async () => {
    await mount();
    list('Premium').canDrop = (candidate) => candidate.value !== 'lamp';
    await settle();

    const marks = await marksDuring(() => userEvent.dragAndDrop(item('lamp'), list('Premium')));

    expect(marks).toContain('lamp:data-dragging:+');
    expect(marks).not.toContain('Premium:data-drop-target:+');
  });

  it('requests nothing when such an item is dropped on it', async () => {
    await mount();
    list('Premium').canDrop = (candidate) => candidate.value !== 'lamp';
    await settle();

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();

    expect(requests).toHaveLength(0);
  });

  it('accepts the items its canDrop lets in', async () => {
    await mount();
    list('Premium').canDrop = (candidate) => candidate.value !== 'lamp';

    await userEvent.dragAndDrop(item('chair'), list('Premium'));
    await settle();

    expect(requests.map((r) => r.value)).toEqual(['chair']);
  });

  it('passes canDrop the item and the list it comes from', async () => {
    await mount();
    const calls: [string, string][] = [];
    list('Premium').canDrop = (candidate, from) => {
      calls.push([candidate.value, from.value]);
      return true;
    };

    await userEvent.click(moveButton('Notebook'));
    await settle();

    expect(calls).toContainEqual(['notebook', 'standard']);
  });

  it('leaves such a list out of the menu', async () => {
    await mount();
    list('Premium').canDrop = (candidate) => candidate.value !== 'lamp';

    await userEvent.click(moveButton('Desk lamp'));
    await settle();

    expect(menuItems()).toEqual(['Standard']);
  });

  it('asks again when the item changes', async () => {
    await mount();
    list('Premium').canDrop = (candidate) => candidate.dataset.kind === 'light';

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    expect(menuItems()).toEqual(['Standard']);
    await userEvent.keyboard('{Escape}');
    await settle();

    item('lamp').dataset.kind = 'light';
    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    expect(menuItems()).toEqual(['Standard', 'Premium']);
  });

  it('disables the move button of an item no list accepts', async () => {
    await mount();
    for (const label of ['Unpriced', 'Standard', 'Premium']) list(label).canDrop = () => false;
    await settle();

    expect(moveButton('Desk lamp').element()).toHaveProperty('disabled', true);
  });
});

describe('Slots of a list', () => {
  it('shows its label as a heading, unless the page fills the header slot', async () => {
    await mount(
      MARKUP.replace(
        '<l-board-list label="Standard" value="standard">',
        '<l-board-list label="Standard" value="standard"><strong slot="header">€0.0032 per page</strong>',
      ),
    );

    const heading = (label: string) =>
      list(label).shadowRoot!.querySelector<HTMLElement>('[part="label"]');
    expect(heading('Unpriced')?.checkVisibility()).toBe(true);
    expect(heading('Standard')?.checkVisibility() ?? false).toBe(false);
    expect(page.getByText('€0.0032 per page').element().checkVisibility()).toBe(true);
  });

  it('renders footer content below the items, outside the list', async () => {
    await mount(
      MARKUP.replace(
        '<l-board-list label="Premium" value="premium">',
        '<l-board-list label="Premium" value="premium"><button slot="footer">Add a product</button>',
      ),
    );

    const add = page.getByRole('button', { name: 'Add a product' }).element();
    expect(add.checkVisibility()).toBe(true);
    expect(
      page
        .getByRole('list')
        .elements()
        .some((l: Element) => l.contains(add)),
    ).toBe(false);
  });
});

describe('Announcements', () => {
  it('announces through ariaNotify where the browser has it', async () => {
    const board = await mount();
    const notify = vi.fn();
    (Element.prototype as Notifier).ariaNotify = notify;
    applyRequests();

    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    expect(notify.mock.calls).toEqual([['Desk lamp moved to Standard']]);
    expect(notify.mock.contexts[0]).toBe(board);
    expect(status()).toBe('');
  });

  it('marks the live region atomic', async () => {
    await mount();

    expect(page.getByRole('status').element().getAttribute('aria-atomic')).toBe('true');
  });

  it('fills the live region a frame after clearing it, so it is not coalesced', async () => {
    await mount();
    await userEvent.dragAndDrop(item('lamp'), list('Standard'));
    await settle();

    list('Standard').append(item('lamp'));
    // The sync and the board's render run as microtasks.
    await new Promise((r) => setTimeout(r, 0));
    expect(status()).toBe('');

    await nextFrame();
    await nextFrame();
    await new Promise((r) => setTimeout(r, 0));
    expect(status()).toBe('Desk lamp moved to Standard');
  });
});

describe('Keeping up with the page', () => {
  const SLOTTED = MARKUP.replace(
    '<l-board-list label="Premium" value="premium"></l-board-list>',
    `<l-board-list label="Premium" value="premium">
      <strong slot="header">€9.90</strong>
      <select slot="footer" aria-label="Add a product"><option>Add…</option></select>
    </l-board-list>`,
  );

  it('does not re-render items when the header or footer changes', async () => {
    await mount(SLOTTED);
    // Spying on `render` reads an internal; the observable effect (nothing
    // changes on screen) can't tell a skipped render from a repeated one.
    const render = vi.spyOn(BoardItem.prototype, 'render');

    try {
      host.querySelector('select')!.append(new Option('Desk lamp', 'lamp'));
      host.querySelector('strong')!.firstChild!.textContent = '€12.90';
      host.querySelector('strong')!.setAttribute('title', 'per unit');
      await settle();

      expect(render).not.toHaveBeenCalled();
    } finally {
      render.mockRestore();
    }
  });

  it('re-renders the items when a list is renamed', async () => {
    await mount(SLOTTED);
    const render = vi.spyOn(BoardItem.prototype, 'render');

    try {
      list('Premium').setAttribute('label', 'Luxury');
      await settle();

      expect(render).toHaveBeenCalledTimes(3);
    } finally {
      render.mockRestore();
    }
  });
});

describe('When the page takes things away', () => {
  it('reports an empty state for a board without lists', async () => {
    const board = await mount('<l-board label="Empty"></l-board>');

    expect(board.lists).toEqual([]);
    expect(board.state).toEqual({});
  });

  it('announces nothing when the page removes the item instead of moving it', async () => {
    await mount();

    await userEvent.click(moveButton('Desk lamp'));
    await settle();
    await userEvent.click(menuItem('Standard'));
    await settle();
    item('lamp').remove();
    await settle();

    expect(status()).toBe('');
  });

  it('ends a drag when the page takes the board out of the document mid-gesture', async () => {
    const board = await mount();
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener('error', onError);
    // Out and back in, as a framework re-mounting it would: the drop still has
    // somewhere to land, and the board has to have let go of the drag.
    host.addEventListener('dragstart', () => queueMicrotask(() => host.append(board)), {
      once: true,
    });

    try {
      await userEvent.dragAndDrop(item('lamp'), list('Standard'));
      await settle();
    } finally {
      window.removeEventListener('error', onError);
    }

    expect(errors).toEqual([]);
    expect(requests).toHaveLength(0);
    expect(host.querySelectorAll('[data-dragging], [data-drop-target]')).toHaveLength(0);
  });
});

describe('Localized strings', () => {
  it('names the button, the placeholder and the announcement in the page’s language', async () => {
    await mount(MARKUP.replace('<l-board', '<l-board lang="fr"'));
    applyRequests();

    expect(
      page.getByRole('button', { name: 'Déplacer Desk lamp vers…', exact: true }).elements(),
    ).toHaveLength(1);
    expect(placeholder('Premium')?.textContent?.trim()).toBe('Déposer ici');

    await userEvent.dragAndDrop(item('lamp'), list('Premium'));
    await settle();
    expect(status()).toBe('Déplacement de Desk lamp vers Premium');
  });
});

describe('Accessibility', () => {
  describe('Roles and accessible names', () => {
    it('exposes the board as a group named by its label (WCAG 4.1.2 / RGAA 7.1)', async () => {
      await mount();

      expect(page.getByRole('group', { name: 'Price tiers' }).elements()).toHaveLength(1);
    });

    it('exposes each list as a group named by its label, holding a list of items', async () => {
      await mount();

      expect(page.getByRole('group', { name: 'Unpriced' }).elements()).toHaveLength(1);
      // The items are the page's own children, slotted into the list's shadow
      // root, so they are looked up by role and then by the list they are in.
      const lists = page.getByRole('list').elements();
      expect(
        lists.filter((l: Element) => (l.getRootNode() as ShadowRoot).host === list('Unpriced')),
      ).toHaveLength(1);
      const items = page
        .getByRole('listitem')
        .elements()
        .filter((el: Element) => list('Unpriced').contains(el));
      expect(items.map((el: Element) => (el.textContent ?? '').trim())).toEqual([
        'Desk lamp',
        'Office chair',
      ]);
    });

    it('announces moves in a polite live region (WCAG 4.1.3 / RGAA 7.5)', async () => {
      await mount();

      expect(page.getByRole('status').element().getAttribute('aria-live') ?? 'polite').toBe(
        'polite',
      );
    });

    it('names the menu after its button', async () => {
      await mount();

      await userEvent.click(moveButton('Desk lamp'));
      await settle();

      expect(page.getByRole('menu', { name: 'Move Desk lamp to…' }).elements()).toHaveLength(1);
    });
  });

  describe('Keyboard interaction (APG menu button)', () => {
    it('opens the menu with Enter, and moves to the focused list with Enter (WCAG 2.1.1 / RGAA 7.3)', async () => {
      await mount();

      await userEvent.tab();
      expect(deepActiveElement()).toBe(moveButton('Desk lamp').element());
      await userEvent.keyboard('{Enter}');
      await settle();
      expect(deepActiveElement()).toBe(menuItem('Standard'));

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');
      await settle();

      expect(requests.map((r) => r.to)).toEqual([list('Premium')]);
    });

    it('closes the menu with Escape and returns focus to its button', async () => {
      await mount();

      await userEvent.tab();
      await userEvent.keyboard('{Enter}');
      await settle();
      await userEvent.keyboard('{Escape}');
      await settle();

      expect(menuItems()).toEqual([]);
      expect(deepActiveElement()).toBe(moveButton('Desk lamp').element());
      expect(requests).toHaveLength(0);
    });
  });

  describe('Focus management', () => {
    it('reaches every movable item in order, skipping disabled ones (WCAG 2.4.3 / RGAA 12.8)', async () => {
      await mount(MARKUP.replace('value="chair"', 'value="chair" disabled'));

      await userEvent.tab();
      expect(deepActiveElement()).toBe(moveButton('Desk lamp').element());
      await userEvent.tab();
      expect(deepActiveElement()).toBe(moveButton('Notebook').element());
    });
  });
});
