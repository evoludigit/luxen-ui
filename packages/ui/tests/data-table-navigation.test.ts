// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
import { rowTarget } from '../src/html/elements/data-table/row-navigation.js';

describe('A navigation key moves to a row', () => {
  it('moves one row up or down', () => {
    expect(rowTarget('ArrowDown', 2, 5)).toBe(3);
    expect(rowTarget('ArrowUp', 2, 5)).toBe(1);
  });

  it('stops at the first and last rows instead of wrapping', () => {
    expect(rowTarget('ArrowUp', 0, 5)).toBe(0);
    expect(rowTarget('ArrowDown', 4, 5)).toBe(4);
  });

  it('jumps to the first or last row', () => {
    expect(rowTarget('Home', 3, 5)).toBe(0);
    expect(rowTarget('End', 1, 5)).toBe(4);
  });

  it('moves a page of rows, clamped to the table', () => {
    expect(rowTarget('PageDown', 0, 30)).toBe(10);
    expect(rowTarget('PageDown', 25, 30)).toBe(29);
    expect(rowTarget('PageUp', 12, 30)).toBe(2);
    expect(rowTarget('PageUp', 4, 30)).toBe(0);
  });

  it('takes a page size', () => {
    expect(rowTarget('PageDown', 0, 30, 5)).toBe(5);
  });

  it('answers null for a key it does not handle, or an empty table', () => {
    expect(rowTarget('ArrowLeft', 2, 5)).toBeNull();
    expect(rowTarget('a', 2, 5)).toBeNull();
    expect(rowTarget('ArrowDown', 0, 0)).toBeNull();
  });
});
