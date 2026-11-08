import { getConfig, subscribe } from './config';
import { createGlassMap, FILTER_PADDING, type GlassShape } from './map';

const SVG_NS = 'http://www.w3.org/2000/svg';
// A filter nobody uses any more is dropped after this, in case it's needed again.
const RELEASE_DELAY = 2000;

type GlassMap = NonNullable<ReturnType<typeof createGlassMap>>;
type Entry = { id: string; filter: SVGFilterElement; map: GlassMap; users: number; timer?: number };
export type Acquired = { key: string; entry: Entry };

const entries = new Map<string, Entry>();
let defs: SVGDefsElement | undefined;
let nextId = 0;
let watching = false;

function svg(tag: string, attributes: Record<string, string | number>) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function getDefs() {
  if (!defs) {
    const root = svg('svg', { 'aria-hidden': 'true' });
    root.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none;';
    defs = document.createElementNS(SVG_NS, 'defs');
    root.append(defs);
    document.body.append(root);
  }

  return defs;
}

function fill({ filter, map }: Entry) {
  const { chromaticAberration, chromaticAberrationStrength: shift } = getConfig();
  const channel = (values: string, result: string) =>
    svg('feColorMatrix', { in: 'distorted', type: 'matrix', values, result });

  const primitives = [
    svg('feImage', { href: map.href, preserveAspectRatio: 'none', result: 'map' }),
    svg('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: map.scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'distorted'
    })
  ];

  if (chromaticAberration) {
    primitives.push(
      channel('1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'red'),
      svg('feOffset', { in: 'red', dx: shift, dy: 0, result: 'redShifted' }),
      channel('0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'green'),
      channel('0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'blue'),
      svg('feOffset', { in: 'blue', dx: -shift, dy: 0, result: 'blueShifted' }),
      svg('feBlend', { in: 'redShifted', in2: 'green', mode: 'screen', result: 'redGreen' }),
      svg('feBlend', { in: 'redGreen', in2: 'blueShifted', mode: 'screen' })
    );
  }

  filter.replaceChildren(...primitives);
}

// The filters are rebuilt in place when the chromatic aberration settings change.
function watch() {
  if (!watching) {
    watching = true;
    subscribe(() => entries.forEach(fill));
  }
}

export function shapeKey({ width, height, radius }: GlassShape) {
  return `${width}x${height}r${radius}`;
}

// Filters are built once per shape and shared between elements of that shape.
export function acquire(shape: GlassShape): Acquired | undefined {
  const key = shapeKey(shape);
  let entry = entries.get(key);

  if (!entry) {
    const map = createGlassMap(shape);
    if (!map) {
      return undefined;
    }

    const filter = svg('filter', {
      id: `liquid-glass-${nextId++}`,
      x: `${-FILTER_PADDING * 100}%`,
      y: `${-FILTER_PADDING * 100}%`,
      width: `${(1 + 2 * FILTER_PADDING) * 100}%`,
      height: `${(1 + 2 * FILTER_PADDING) * 100}%`,
      'color-interpolation-filters': 'sRGB'
    }) as SVGFilterElement;
    entry = { id: filter.id, filter, map, users: 0 };
    entries.set(key, entry);
    fill(entry);
    getDefs().append(filter);
  }

  clearTimeout(entry.timer);
  entry.users++;
  watch();
  return { key, entry };
}

export function release({ key, entry }: Acquired) {
  entry.users--;
  if (entry.users > 0) {
    return;
  }

  entry.timer = window.setTimeout(() => {
    if (entry.users === 0) {
      entry.filter.remove();
      entries.delete(key);
    }
  }, RELEASE_DELAY);
}
