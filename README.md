# liquid-glass

A glass effect for any element, set with a data attribute: backdrop blur, a lens-like distortion at the edges that follows the element's own size and corner radius, and a soft glow just inside the rim. No dependencies, about 13 KB, and no framework.

## Install

```sh
npm install @gabrielfins/liquid-glass
```

## Use

Import the package once, then add the attribute to any element:

```js
import '@gabrielfins/liquid-glass';
```

```html
<div class="card" data-liquid-glass="8">...</div>
```

Give the element a size and a `border-radius`; the glass follows both, including while they animate. It needs something behind it to bend, so it belongs over images, gradients or text.

Elements are found when they are added to the page, moved or removed, and when their attributes change, so it works with whatever produces the markup: plain HTML, a CMS, or any framework.

## Attributes

| Attribute | |
|---|---|
| `data-liquid-glass` | Turns the glass on. Its value is the blur in pixels (`data-liquid-glass="12"`), or a preset: `sm` 2, `md` 8, `lg` 12, `xl` 16. With no value the blur is 2. |
| `data-liquid-glass-glow` | `"false"` leaves the glow off, for glass that is only the pressed state of a knob. `"pseudo"` draws it on the pseudo-element instead. |
| `data-liquid-glass-pseudo` | `"::before"` or `"::after"`: the glass is drawn by a pseudo-element, which can't take an inline style. The filter goes to the `--glass-filter` custom property, so give the pseudo-element `backdrop-filter: var(--glass-filter)`. Its box is measured. To put glass inside glass, see below. |
| `data-liquid-glass-enabled` | `"false"` clears the glass, for elements that are only glass at some sizes. |

## Glass inside glass

An element with a `backdrop-filter` hides the page from everything inside it. So glass inside glass shows no effect: the inner element can only blur what is inside the outer one.

To nest them, draw the outer glass on a pseudo-element with `data-liquid-glass-pseudo`. The element itself no longer has a filter, so the glass inside it sees the page behind.

```html
<header class="bar" data-liquid-glass="12" data-liquid-glass-pseudo="::before">
  <nav class="menu" data-liquid-glass="12">...</nav>
</header>
```

```css
.bar { position: relative; isolation: isolate; }

.bar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  backdrop-filter: var(--glass-filter);
}
```

## Settings for every element

```js
import { configure } from '@gabrielfins/liquid-glass';

configure({ chromaticAberration: true, glowSize: 12 });
```

| Setting | Default | |
|---|---|---|
| `distortion` | `'auto'` | `'auto'` draws the distortion only where the browser can (see below); `true` or `false` forces it. |
| `brightness` | `1.1` | Multiplies the backdrop's brightness. |
| `chromaticAberration` | `false` | Splits the colour channels at the edges. A few more filter primitives. |
| `chromaticAberrationStrength` | `1` | How far apart the channels are pulled, in pixels. |
| `glow` | `true` | The glow just inside the edge. |
| `glowSize` | `8` | How far it reaches, in pixels. |
| `glowStrength` | `0.1` | Its opacity at the very edge, 0 to 1. |

Changes apply to every glass element at once. `getConfig()` reads the current values and `subscribe(fn)` listens for changes.

### Glow colour

The glow reads the `--liquid-glass-glow-color` custom property (white by default) where each element sits, so it can differ per theme, section or element:

```css
.dark-section { --liquid-glass-glow-color: #8690e9; }
```

## Without the observer

`import '@gabrielfins/liquid-glass'` starts watching the page. To control it yourself, import the functions alone from `/core`, which starts nothing:

```js
import { glass } from '@gabrielfins/liquid-glass/core';

const card = glass(document.querySelector('.card'), { blur: 8 });

card.update({ blur: 12 });
card.destroy();
```

The options are `blur`, `enabled`, `glow` and `pseudo`, as above. `configure`, `getConfig` and `subscribe` are exported from both entries and share one set of settings.

## Browser support

The blur and brightness work in every browser with `backdrop-filter`. The **distortion** only works in **Chromium** (Chrome, Edge, Vivaldi, Opera): it uses an SVG filter inside `backdrop-filter`, which other engines parse but don't draw, and then they drop the blur too. With `distortion: 'auto'` the library leaves the distortion out elsewhere, so the plain blur still shows.

There is no feature test for this (`CSS.supports` says yes), so `'auto'` checks for `navigator.userAgentData`, which only Chromium has. `supportsDistortion()` exposes that check. It will need updating if Firefox or Safari add support.

## Cost

A glass element runs a backdrop filter, which is among the pricier CSS effects, and the distortion adds an SVG filter on top. Filters are built once per size and shared between elements of that size, and sizes are rounded to 4 px so an animating width doesn't build one per frame. Hundreds of glass elements on screen at once will be slow on weak GPUs.

## Develop

```sh
npm install
npm run dev         # the docs site (docs/), with the live playground
npm run docs:build  # the docs site, built to site/
npm run build       # the library, to dist/ (ESM and types)
npm run check       # type-check
```
