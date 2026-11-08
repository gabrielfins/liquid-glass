import { getConfig, subscribe } from './config';

// Elements that can't hold a child.
const NO_CHILDREN = 'input, textarea, select, img';

// The glow just inside a glass element's edge. How far it reaches and how bright
// it is are settings.
//
// It is a stack of uniform bands, not a blur: a blurred inset shadow gets a
// quarter brighter at a corner, where it is lit from two sides, and bands follow
// the outline at one distance all the way round.
const GLOW_CURVE = 1.5;
const GLOW_MAX_BANDS = 16;

function glowShadow(size: number, strength: number) {
  const bands = Math.max(1, Math.min(GLOW_MAX_BANDS, Math.round(size)));
  const step = size / bands;
  // How much of the colour is left at a depth: full at the edge, none at the size.
  const level = (depth: number) => strength * Math.max(0, 1 - depth / size) ** GLOW_CURVE;

  // Each band is wider than the last and lies over it, so it adds only the
  // difference between its depth's level and the next one's.
  return Array.from({ length: bands }, (_, index) => {
    const outer = (index + 1) * step;
    const share = level(outer - step / 2) - (index + 1 < bands ? level(outer + step / 2) : 0);
    return `inset 0 0 0 ${outer.toFixed(2)}px color-mix(in srgb, var(--liquid-glass-glow-color, white) ${(share * 100).toFixed(2)}%, transparent)`;
  }).join(', ');
}

function glowStyles() {
  const { glowSize, glowStrength } = getConfig();
  const size = Math.max(1, Number(glowSize) || 1);
  const strength = Math.min(1, Math.max(0, Number(glowStrength) || 0));

  return `
    .liquid-glass-glow, [data-liquid-glass-glow] {
      --liquid-glass-glow-shadow: ${glowShadow(size, strength)};
    }
    .liquid-glass-glow {
      position: absolute;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: var(--liquid-glass-glow-shadow);
    }
    [data-liquid-glass-glow='pseudo']::before {
      box-shadow: var(--liquid-glass-glow-shadow);
    }
  `;
}

let styleEl: HTMLStyleElement | undefined;

function addGlowStyles() {
  if (!styleEl) {
    const element = document.createElement('style');
    const update = () => {
      element.textContent = glowStyles();
    };
    update();
    document.head.append(element);
    subscribe(update);
    styleEl = element;
  }
}

// Draws the glow as an overlay child, covering the element's own border when it
// has one. Elements that can't hold a child, or that scroll their content, get
// it as an inset shadow of their own instead, which keeps any shadow they have.
export function addGlow(node: HTMLElement) {
  addGlowStyles();
  const style = getComputedStyle(node);

  if (node.matches(NO_CHILDREN) || /auto|scroll/.test(style.overflow)) {
    const shadow = style.boxShadow;
    const own = 'var(--liquid-glass-glow-shadow)';
    node.style.boxShadow = shadow === 'none' ? own : `${shadow}, ${own}`;
    node.dataset.liquidGlassGlow = 'inset';

    return () => {
      node.style.removeProperty('box-shadow');
      delete node.dataset.liquidGlassGlow;
    };
  }

  const overlay = document.createElement('span');
  overlay.className = 'liquid-glass-glow';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.inset = `-${style.borderTopWidth} -${style.borderRightWidth} -${style.borderBottomWidth} -${style.borderLeftWidth}`;

  // The overlay is positioned against the element, so a static one needs to be a containing block.
  const wasStatic = style.position === 'static';
  if (wasStatic) {
    node.style.position = 'relative';
  }

  node.append(overlay);

  return () => {
    overlay.remove();
    if (wasStatic) {
      node.style.removeProperty('position');
    }
  };
}

// For glass drawn by a pseudo-element whose box isn't the element's own, so the
// glow goes on the pseudo-element itself.
export function addPseudoGlow(node: HTMLElement) {
  addGlowStyles();
  node.dataset.liquidGlassGlow = 'pseudo';

  return () => {
    delete node.dataset.liquidGlassGlow;
  };
}
