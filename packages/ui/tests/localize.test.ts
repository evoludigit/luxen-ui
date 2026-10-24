// Pulls in the ambient `declare module 'vitest'` stub (vitest is injected by the
// Vite+ runner at runtime, so its types aren't resolvable to the lint checker).
// oxlint-disable-next-line typescript/triple-slash-reference -- required: test files aren't in any tsconfig include.
/// <reference path="./vitest.d.ts" />
import { describe, expect, it } from 'vitest';
// Imported in the plain Node test environment (no DOM). This is the SSR-safety
// guarantee: importing the engine — and a real locale — must not touch
// document/window at module scope, and term resolution must work with no DOM.
import { getTranslation, resolveTerm } from '../src/html/shared/localize.js';
import '../src/html/translations/fr.js';
import '../src/html/translations/ko.js';

describe('localize engine (Node / SSR-safe)', () => {
  it('imports without a DOM and resolves the English fallback', () => {
    expect(typeof globalThis.document).toBe('undefined'); // proves we are DOM-less
    expect(resolveTerm('en', 'loading')).toBe('Loading');
  });

  it('resolves a registered locale', () => {
    expect(resolveTerm('fr', 'loading')).toBe('Chargement');
    expect(resolveTerm('fr', 'nextSlide')).toBe('Diapositive suivante');
  });

  it('falls back from a regional code to its primary subtag', () => {
    expect(resolveTerm('fr-CA', 'loading')).toBe('Chargement');
    expect(getTranslation('fr-CA').$code).toBe('fr');
  });

  it('falls back to English for an unregistered locale', () => {
    expect(resolveTerm('de', 'loading')).toBe('Loading');
    expect(getTranslation('de').$code).toBe('en');
  });

  it('resolves parameterized (function) terms', () => {
    expect(resolveTerm('en', 'goToSlide', 3)).toBe('Go to slide 3');
    expect(resolveTerm('fr', 'goToSlide', 3)).toBe('Aller à la diapositive 3');
  });
});

describe('board announcements', () => {
  it('reads in French without agreeing with the item', () => {
    expect(resolveTerm('fr', 'itemMoved', 'Lampe de bureau', 'Premium')).toBe(
      'Déplacement de Lampe de bureau vers Premium',
    );
  });

  it('picks the Korean particles from a Hangul label’s final syllable', () => {
    // 상 and 엄 end in a consonant: 을, 으로.
    expect(resolveTerm('ko', 'itemMoved', '책상', '프리미엄')).toBe('책상을 프리미엄으로 이동함');
    // 자 ends in a vowel: 를; 울 ends in ㄹ, which takes 로.
    expect(resolveTerm('ko', 'itemMoved', '의자', '서울')).toBe('의자를 서울로 이동함');
    // 리 ends in a vowel: 로.
    expect(resolveTerm('ko', 'itemMoved', '램프', '갤러리')).toBe('램프를 갤러리로 이동함');
  });

  it('keeps both Korean particles for a label that does not end in Hangul', () => {
    expect(resolveTerm('ko', 'itemMoved', 'Desk lamp', 'Premium 2')).toBe(
      'Desk lamp을(를) Premium 2(으)로 이동함',
    );
  });
});
