// Builds the displacement map the SVG filter reads, for one size and corner radius.
export type GlassShape = { width: number; height: number; radius: number };

// The push dies off exponentially from the edge, so it hugs the rim and still
// fades continuously to the middle. The decay length is a fraction of the
// shorter side, though small elements fade a bit slower, up to a limit, so
// they don't look flat.
const DECAY_RATIO = 0.08;
const SOFT_DECAY_RATIO = 0.12;
const SOFT_DECAY_MAX = 10;
// Pixels of displacement at the middle of an edge, as a fraction of the shorter
// side. The floor keeps small elements lively, since a pure ratio would leave
// them with almost no push; the cap keeps big panels from getting extreme.
const EDGE_PUSH_RATIO = 1.123;
const EDGE_PUSH_MIN = 78;
const EDGE_PUSH_MAX = 100;
// How far the palette reaches from neutral at the middle of an edge (as a
// fraction of half the channel range), which is what the edge push is measured at.
const PALETTE_REACH = 0.78;
// Blue isn't read by the filter, so it only shapes how the map looks. It fades
// to the middle with its own long tail instead of going flat.
const BLUE_TAIL = 0.3;
// Corner colours, clockwise from the top left. R and G are the x and y offset,
// so left and top lean low and right and bottom lean high, by the same amount
// on every side so the lens looks even. B isn't read by the filter.
const CORNER_COLOURS = ['#1C1C36', '#E31C36', '#E3E336', '#1CE336'].map((hex) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))
);
const [TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT] = CORNER_COLOURS;
// The map is drawn small and stretched by the filter, which keeps it cheap.
const MAP_MAX_SIDE = 128;

// The filter region is the element's box plus this on every side (as a
// fraction), and the map covers all of it.
export const FILTER_PADDING = 0.05;

// Displacement map for a rounded rectangle: the corner colours blended across
// the box, fading to neutral past the bezel so the bands follow the outline and
// cross at the corners. R and G hold the x and y offset, with 127.5 meaning none.
export function createGlassMap({ width, height, radius }: GlassShape) {
  const edgePush = Math.min(Math.max(EDGE_PUSH_RATIO * Math.min(width, height), EDGE_PUSH_MIN), EDGE_PUSH_MAX);
  const regionWidth = width * (1 + 2 * FILTER_PADDING);
  const regionHeight = height * (1 + 2 * FILTER_PADDING);
  const pxPerTexel = Math.max(regionWidth, regionHeight) / MAP_MAX_SIDE;
  const mapWidth = Math.max(2, Math.round(regionWidth / pxPerTexel));
  const mapHeight = Math.max(2, Math.round(regionHeight / pxPerTexel));

  const canvas = document.createElement('canvas');
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }

  const image = context.createImageData(mapWidth, mapHeight);
  const coreX = width / 2 - radius;
  const coreY = height / 2 - radius;
  const shorter = Math.min(width, height);
  const decay = Math.max(DECAY_RATIO * shorter, Math.min(SOFT_DECAY_RATIO * shorter, SOFT_DECAY_MAX));
  const falloff = (depth: number) => (depth <= 0 ? 1 : Math.exp(-depth / decay));

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const u = (x + 0.5) / mapWidth;
      const v = (y + 0.5) / mapHeight;
      const absX = Math.abs((u - 0.5) * regionWidth);
      const absY = Math.abs((v - 0.5) * regionHeight);
      // How far into the rounded corner, then where the outline is along this
      // row and column: the straight edge, or the arc.
      const cornerX = Math.max(0, absX - coreX);
      const cornerY = Math.max(0, absY - coreY);
      const edgeX = coreX + Math.sqrt(Math.max(0, radius * radius - cornerY * cornerY));
      const edgeY = coreY + Math.sqrt(Math.max(0, radius * radius - cornerX * cornerX));
      const pushX = falloff(edgeX - absX);
      const pushY = falloff(edgeY - absY);
      const strength = 1 - (1 - pushX) * (1 - pushY);
      const middle = Math.min(1, Math.min(edgeX - absX, edgeY - absY) / (Math.min(width, height) / 2));
      const blueStrength = Math.max(strength, BLUE_TAIL * (1 - Math.max(0, middle)));

      const offset = (y * mapWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const top = TOP_LEFT[channel] + (TOP_RIGHT[channel] - TOP_LEFT[channel]) * u;
        const bottom = BOTTOM_LEFT[channel] + (BOTTOM_RIGHT[channel] - BOTTOM_LEFT[channel]) * u;
        const colour = top + (bottom - top) * v;
        image.data[offset + channel] = Math.round(127.5 + (colour - 127.5) * (channel === 2 ? blueStrength : strength));
      }
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  // feDisplacementMap offsets by scale * (channel - 0.5), and an edge's colours
  // reach PALETTE_REACH of the way to either end of the channel.
  return { href: canvas.toDataURL('image/png'), scale: (2 * edgePush) / PALETTE_REACH };
}
