---
outline: deep
---

<script setup>
import basic from '../.vitepress/examples/pagination/Basic.html?raw'
import firstPage from '../.vitepress/examples/pagination/FirstPage.html?raw'
import compact from '../.vitepress/examples/pagination/Compact.html?raw'
import withTable from '../.vitepress/examples/pagination/WithTable.html?raw'
</script>

# Pagination <Badge type="tip">&lt;nav&gt;</Badge>

Links to the pages of a long list.

<ElementSpec element="pagination" />

::: code-group

```html [HTML]
<nav
  class="l-pagination"
  aria-label="Pagination"
>
  <p>51–100 of 1,284</p>
  <ol>
    <li>
      <a
        href="?page=2"
        aria-current="page"
        >2</a
      >
    </li>
    <li>
      <a
        href="?page=3"
        data-step="next"
        >Next</a
      >
    </li>
  </ol>
</nav>
```

:::

There is **no JavaScript**. A page is a link and the URL holds the page, so the markup works in a server-rendered page and with any router's link component: the current page carries `aria-current="page"`, and a step that leads nowhere is a link without `href`, which the browser already keeps out of the tab order.

## Options

### Basic

Add `class="l-pagination"` to a `<nav>` named with `aria-label`. Put the range shown in a `<p>` first, then one `<li><a>` per page in an `<ol>`. Mark the current page with `aria-current="page"`, the previous and next links with `data-step`, and a gap between page numbers with `<li aria-hidden="true">…</li>`.

<ComponentWrapper :html="basic" />

::: details Code
::: code-group
<<< @/.vitepress/examples/pagination/Basic.html [HTML]
:::

### First and last page

Leave out the `href` of a step that leads nowhere, and add `aria-disabled="true"` so assistive tech announces it as unavailable.

<ComponentWrapper :html="firstPage" />

::: details Code
::: code-group
<<< @/.vitepress/examples/pagination/FirstPage.html [HTML]
:::

### Compact

Keep only the steps and the current page; name the glyph-only steps with `.l-visually-hidden` text.

<ComponentWrapper :html="compact" />

::: details Code
::: code-group
<<< @/.vitepress/examples/pagination/Compact.html [HTML]
:::

## Examples

### Under a table

<ComponentWrapper :html="withTable" />

::: details Code
::: code-group
<<< @/.vitepress/examples/pagination/WithTable.html [HTML]
:::

## Accessibility

### Criteria

<AccessibilityTable :data="[
  { Check: 'Landmark', Description: 'A `<nav>` named with `aria-label` exposes the pagination as a navigation region', WCAG: '[WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), [RGAA 12.6](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#12.6)' },
  { Check: 'Current page', Description: '`aria-current=&quot;page&quot;` identifies it; it is also set apart by weight, not by color alone', WCAG: '[WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 3.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#3.1)' },
  { Check: 'Unavailable step', Description: 'A link without `href` takes no focus; `aria-disabled=&quot;true&quot;` announces it as unavailable', WCAG: '[WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [RGAA 7.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#7.1)' },
  { Check: 'Target size', Description: 'Every link is at least the small control size, above the 24 px minimum', WCAG: '[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)' },
  { Check: 'Focus ring', Description: 'Links show the Luxen focus ring', WCAG: '[WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [RGAA 10.7](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#10.7)' },
]" :rules="[
  'Name the `&lt;nav&gt;` with `aria-label`, e.g. `Pagination`',
  'Mark the current page with `aria-current=&quot;page&quot;`',
  'Remove the `href` of an unavailable step and add `aria-disabled=&quot;true&quot;`',
  'Name glyph-only steps with `.l-visually-hidden` text',
]" />

### Keyboard interactions

<KeyboardTable :data="[
  { Key: 'Tab', Description: 'Moves to the next page link, skipping unavailable steps' },
  { Key: 'Enter', Description: 'Follows the focused link' },
]" />

## API reference

### Importing

::: code-group

```css [CSS]
@import 'luxen-ui/css/pagination';
```

:::

### Attributes

<ApiTable element="pagination" section="attributes" />

### CSS classes

<ApiTable element="pagination" section="cssClasses" />
