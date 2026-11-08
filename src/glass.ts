import { distortionEnabled, getConfig, subscribe } from './config';
import { acquire, release, shapeKey, type Acquired } from './filters';
import { addGlow, addPseudoGlow } from './glow';
import type { GlassShape } from './map';

// Sizes are rounded to this, so a width transition doesn't build a filter per frame.
const SIZE_STEP = 4;
const RADIUS_STEP = 2;

export const glassBlur = {
  sm: 2,
  md: 8,
  lg: 12,
  xl: 16
} as const;

export type GlassOptions = {
  // Blur radius in pixels, behind the glass.
  blur?: number;
  // False clears the filter, for elements that are only glass at some sizes.
  enabled?: boolean;
  // False leaves the glow off, for glass that is only the pressed state of a knob.
  // 'pseudo' puts it on the pseudo-element, when that isn't the element's own box.
  glow?: boolean | 'pseudo';
  // Sets --glass-filter instead of backdrop-filter, for glass drawn by a
  // pseudo-element, which can't take an inline style. Its box is measured.
  pseudo?: '::before' | '::after';
};

export type Glass = {
  update(options?: number | GlassOptions): void;
  destroy(): void;
};

type Resolved = Required<Omit<GlassOptions, 'pseudo'>> & Pick<GlassOptions, 'pseudo'>;

function resolve(options: number | GlassOptions | undefined): Resolved {
  const given = typeof options === 'number' ? { blur: options } : (options ?? {});
  // An option set to undefined means "not given", so it must not override a default.
  const defined = Object.fromEntries(Object.entries(given).filter(([, value]) => value !== undefined));
  return { blur: glassBlur.sm, enabled: true, glow: true, ...defined };
}

function snap(size: number) {
  return Math.round(size / SIZE_STEP) * SIZE_STEP;
}

function readRadius(style: CSSStyleDeclaration, width: number) {
  const value = style.borderTopLeftRadius.split(' ')[0];
  return value.endsWith('%') ? (Number.parseFloat(value) / 100) * width : Number.parseFloat(value) || 0;
}

// The distortion (feDisplacementMap + chromatic aberration) is the expensive
// part of the effect, not the blur/brightness, so the cheap fallback keeps
// those and drops the url() reference to the SVG filter.
function baseFilter(blur: number, brightness: number) {
  return `brightness(${brightness}) blur(${blur}px)`;
}

// Liquid glass that follows the element's own size and border radius.
export function glass(node: HTMLElement, given?: number | GlassOptions): Glass {
  let options = resolve(given);
  let shape: GlassShape | undefined;
  let acquired: Acquired | undefined;
  let removeGlow: (() => void) | undefined;
  let glowMode: Resolved['glow'] | false = false;

  function apply(value: string) {
    if (options.pseudo) {
      node.style.setProperty('--glass-filter', value);
    } else {
      node.style.backdropFilter = value;
    }
  }

  function setGlow(mode: Resolved['glow'] | false) {
    if (mode === glowMode) {
      return;
    }

    removeGlow?.();
    removeGlow = mode ? (mode === 'pseudo' ? addPseudoGlow(node) : addGlow(node)) : undefined;
    glowMode = mode;
  }

  function render() {
    const config = getConfig();

    if (!options.enabled) {
      apply('');
      if (acquired) {
        release(acquired);
        acquired = undefined;
      }
      setGlow(false);
      return;
    }

    // Keeps the shared filter for this shape, swapping it when the size changes.
    const wanted = distortionEnabled() && shape ? shape : undefined;
    if (wanted && acquired?.key !== shapeKey(wanted)) {
      if (acquired) {
        release(acquired);
      }
      acquired = acquire(wanted);
    } else if (!wanted && acquired) {
      release(acquired);
      acquired = undefined;
    }

    const base = baseFilter(options.blur, config.brightness);
    apply(acquired ? `${base} url(#${acquired.entry.id})` : base);
    setGlow(options.glow && config.glow ? options.glow : false);
  }

  function measure() {
    const style = getComputedStyle(node, options.pseudo);
    const width = snap(options.pseudo ? Number.parseFloat(style.width) || 0 : node.offsetWidth);
    const height = snap(options.pseudo ? Number.parseFloat(style.height) || 0 : node.offsetHeight);
    // Rounded like the size, so a radius transition doesn't build a filter per pixel.
    const radius = Math.round(Math.min(readRadius(style, width), width / 2, height / 2) / RADIUS_STEP) * RADIUS_STEP;

    if (!width || !height) {
      shape = undefined;
    } else if (shape?.width !== width || shape.height !== height || shape.radius !== radius) {
      shape = { width, height, radius };
    } else {
      return;
    }

    render();
  }

  const observer = new ResizeObserver(measure);
  observer.observe(node);

  // A new border radius doesn't resize the box, so the observer above misses it.
  // Measure again when the style or class changes, and on every frame while a
  // transition of the radius or an animation runs on the element.
  const changes = new MutationObserver(() => measure());
  changes.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });

  let running = 0;
  let frame = 0;
  const tick = () => {
    measure();
    frame = running > 0 ? requestAnimationFrame(tick) : 0;
  };
  const begin = (event: Event) => {
    const radius = event instanceof TransitionEvent && /radius/.test(event.propertyName);
    if (event.target === node && (radius || event instanceof AnimationEvent)) {
      running += 1;
      frame ||= requestAnimationFrame(tick);
    }
  };
  const end = (event: Event) => {
    if (event.target === node && running > 0) {
      running -= 1;
    }
  };
  const starts = ['transitionrun', 'animationstart'];
  const ends = ['transitionend', 'transitioncancel', 'animationend', 'animationcancel'];
  starts.forEach((name) => node.addEventListener(name, begin));
  ends.forEach((name) => node.addEventListener(name, end));

  const unsubscribe = subscribe(render);
  measure();
  render();

  return {
    update(next) {
      const before = options;
      options = resolve(next);
      if (before.pseudo !== options.pseudo) {
        before.pseudo ? node.style.removeProperty('--glass-filter') : node.style.removeProperty('backdrop-filter');
        measure();
      }
      // A different glow mode has to be rebuilt, even if it is only the mode that changed.
      render();
    },
    destroy() {
      observer.disconnect();
      changes.disconnect();
      starts.forEach((name) => node.removeEventListener(name, begin));
      ends.forEach((name) => node.removeEventListener(name, end));
      cancelAnimationFrame(frame);
      running = 0;
      frame = 0;
      unsubscribe();
      apply('');
      if (acquired) {
        release(acquired);
        acquired = undefined;
      }
      setGlow(false);
    }
  };
}
