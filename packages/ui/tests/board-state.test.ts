// Pulls in the ambient `declare module 'vitest'` stub (vitest is injected by the
// Vite+ runner at runtime, so its types aren't resolvable to the lint checker).
// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
// Imported in the plain Node test environment: the board's state helpers need
// no DOM, so a page, a store or a server can apply a move with them.
import { move, type BoardMove, type BoardState } from '../src/html/elements/board/board-state.js';

const freeze = <T>(state: Record<string, T[]>): BoardState<T & string> =>
  Object.freeze(
    Object.fromEntries(Object.entries(state).map(([k, v]) => [k, Object.freeze([...v])])),
  ) as BoardState<T & string>;

const STATE = freeze({
  unpriced: ['lamp', 'chair'],
  standard: ['notebook', 'pen'],
  premium: [],
});

const request = (value: string, from: string, to: string, index: number): BoardMove => ({
  value,
  from: { value: from },
  to: { value: to },
  index,
});

describe('move()', () => {
  it('moves an id to the end of another group', () => {
    expect(move(STATE, request('lamp', 'unpriced', 'standard', 2))).toEqual({
      unpriced: ['chair'],
      standard: ['notebook', 'pen', 'lamp'],
      premium: [],
    });
  });

  it('inserts at `index`', () => {
    expect(move(STATE, request('lamp', 'unpriced', 'standard', 1)).standard).toEqual([
      'notebook',
      'lamp',
      'pen',
    ]);
  });

  it('clamps `index` to the group’s length', () => {
    expect(move(STATE, request('lamp', 'unpriced', 'standard', 99)).standard).toEqual([
      'notebook',
      'pen',
      'lamp',
    ]);
    expect(move(STATE, request('lamp', 'unpriced', 'standard', -3)).standard).toEqual([
      'lamp',
      'notebook',
      'pen',
    ]);
  });

  it('matches `{ id }` objects and numbers by their string form', () => {
    const state: BoardState<{ id: number; name: string } | number> = Object.freeze({
      a: Object.freeze([
        { id: 7, name: 'Lamp' },
        { id: 8, name: 'Chair' },
      ]),
      b: Object.freeze([3]),
    });

    const objects = move(state, request('7', 'a', 'b', 0));
    expect(objects.a).toEqual([{ id: 8, name: 'Chair' }]);
    expect(objects.b).toEqual([{ id: 7, name: 'Lamp' }, 3]);
    expect(objects.b[0]).toBe(state.a[0]);
    expect(move(state, request('3', 'b', 'a', 2)).a).toEqual([
      { id: 7, name: 'Lamp' },
      { id: 8, name: 'Chair' },
      3,
    ]);
  });

  it('returns the state itself for an unknown item', () => {
    expect(move(STATE, request('sofa', 'unpriced', 'standard', 0))).toBe(STATE);
  });

  it('returns the state itself for an item that is not in `from`', () => {
    expect(move(STATE, request('notebook', 'unpriced', 'premium', 0))).toBe(STATE);
  });

  it('returns the state itself for an unknown group', () => {
    expect(move(STATE, request('lamp', 'archived', 'standard', 0))).toBe(STATE);
    expect(move(STATE, request('lamp', 'unpriced', 'archived', 0))).toBe(STATE);
  });

  it('returns the state itself for the same group and the same index', () => {
    expect(move(STATE, request('chair', 'unpriced', 'unpriced', 1))).toBe(STATE);
    expect(move(STATE, request('chair', 'unpriced', 'unpriced', 9))).toBe(STATE);
  });

  it('keeps untouched groups, and makes new arrays only for `from` and `to`', () => {
    const next = move(STATE, request('lamp', 'unpriced', 'premium', 0));

    expect(next).not.toBe(STATE);
    expect(next.standard).toBe(STATE.standard);
    expect(next.unpriced).not.toBe(STATE.unpriced);
    expect(next.premium).not.toBe(STATE.premium);
  });

  it('keeps the groups in their order', () => {
    expect(Object.keys(move(STATE, request('notebook', 'standard', 'unpriced', 0)))).toEqual([
      'unpriced',
      'standard',
      'premium',
    ]);
  });

  it('within one group, takes `index` as the final position', () => {
    const state = freeze({ a: ['a', 'b', 'c'] });

    expect(move(state, request('a', 'a', 'a', 2)).a).toEqual(['b', 'c', 'a']);
    expect(move(state, request('c', 'a', 'a', 0)).a).toEqual(['c', 'a', 'b']);
  });

  it('never mutates its input', () => {
    // The fixtures are frozen: a mutation would throw in strict mode.
    expect(() => move(STATE, request('lamp', 'unpriced', 'standard', 0))).not.toThrow();
    expect(STATE.unpriced).toEqual(['lamp', 'chair']);
    expect(STATE.standard).toEqual(['notebook', 'pen']);
  });
});
