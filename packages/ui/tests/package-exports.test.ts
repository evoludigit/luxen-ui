// Pulls in the ambient `declare module 'vitest'` stub (vitest is injected by the
// Vite+ runner at runtime, so its types aren't resolvable to the lint checker).
// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Reads the built package (CI builds before it tests), through Node's own
// resolution of the `exports` map: the package imports itself by name.
const PKG_ROOT = fileURLToPath(new URL('..', import.meta.url));

function runModule(source: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: PKG_ROOT,
    encoding: 'utf-8',
  }).trim();
}

describe('luxen-ui/board/state', () => {
  it('resolves to the board’s state module', () => {
    const url = runModule(`console.log(import.meta.resolve('luxen-ui/board/state'))`);

    expect(fileURLToPath(url)).toBe(`${PKG_ROOT}dist/elements/board/board-state.js`);
  });

  it('imports in Node, with no DOM, and registers no element', () => {
    const out = runModule(`
      const { move } = await import('luxen-ui/board/state');
      const next = move({ a: ['x'], b: [] }, { value: 'x', from: { value: 'a' }, to: { value: 'b' }, index: 0 });
      console.log(JSON.stringify({ customElements: typeof customElements, next }));
    `);

    expect(JSON.parse(out)).toEqual({ customElements: 'undefined', next: { a: [], b: ['x'] } });
  });

  it('loads nothing else, Lit included', () => {
    const built = readFileSync(`${PKG_ROOT}dist/elements/board/board-state.js`, 'utf-8');

    expect(built).not.toMatch(/\bimport\b/);
  });
});
