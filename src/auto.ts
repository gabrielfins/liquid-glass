import { glass, glassBlur, type Glass, type GlassOptions } from './glass';

// The attributes the page controls the glass with:
//   data-liquid-glass="8"         blur in pixels, or a preset: sm, md, lg, xl
//   data-liquid-glass-glow        "false" for no glow, "pseudo" to put it on the pseudo-element
//   data-liquid-glass-pseudo      "::before" or "::after", for glass drawn by a pseudo-element
//   data-liquid-glass-enabled     "false" to clear the glass
const ATTRIBUTE = 'data-liquid-glass';
const GLOW = `${ATTRIBUTE}-glow`;
const PSEUDO = `${ATTRIBUTE}-pseudo`;
const ENABLED = `${ATTRIBUTE}-enabled`;
const SELECTOR = `[${ATTRIBUTE}]`;

const instances = new WeakMap<HTMLElement, Glass>();

function readBlur(value: string): number | undefined {
  if (value in glassBlur) {
    return glassBlur[value as keyof typeof glassBlur];
  }

  const blur = Number.parseFloat(value);
  return Number.isFinite(blur) ? blur : undefined;
}

function readOptions(element: HTMLElement): GlassOptions {
  const glow = element.getAttribute(GLOW);
  const pseudo = element.getAttribute(PSEUDO);

  return {
    blur: readBlur(element.getAttribute(ATTRIBUTE) ?? ''),
    glow: glow === 'pseudo' ? 'pseudo' : glow !== 'false',
    pseudo: pseudo === '::before' || pseudo === '::after' ? pseudo : undefined,
    enabled: element.getAttribute(ENABLED) !== 'false'
  };
}

function apply(element: HTMLElement) {
  const existing = instances.get(element);

  if (existing) {
    existing.update(readOptions(element));
  } else {
    instances.set(element, glass(element, readOptions(element)));
  }
}

function drop(element: HTMLElement) {
  instances.get(element)?.destroy();
  instances.delete(element);
}

// Runs on an element and everything inside it that carries the attribute.
function each(node: Node, action: (element: HTMLElement) => void) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (node.matches(SELECTOR)) {
    action(node);
  }

  node.querySelectorAll<HTMLElement>(SELECTOR).forEach(action);
}

// Finds the elements already on the page, then follows the ones that come, go
// or change their attributes.
export function start() {
  if (typeof document === 'undefined') {
    return;
  }

  const observer = new MutationObserver((records) => {
    // Removals first, so an element that was moved is built again where it landed.
    records.forEach((record) => record.removedNodes.forEach((node) => each(node, drop)));
    records.forEach((record) => {
      record.addedNodes.forEach((node) => each(node, apply));

      if (record.type === 'attributes' && record.target instanceof HTMLElement) {
        record.target.hasAttribute(ATTRIBUTE) ? apply(record.target) : drop(record.target);
      }
    });
  });

  const begin = () => {
    each(document.documentElement, apply);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [ATTRIBUTE, GLOW, PSEUDO, ENABLED]
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', begin, { once: true });
  } else {
    begin();
  }
}
