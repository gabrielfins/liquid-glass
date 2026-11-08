export type GlassConfig = {
  // Whether the SVG distortion is used. 'auto' turns it on only where the browser
  // can draw it (see supportsDistortion); the blur and brightness apply regardless.
  distortion: 'auto' | boolean;
  // Multiplies the backdrop's brightness.
  brightness: number;
  // Splits the colour channels at the edges, like a lens. Costs a few more filter primitives.
  chromaticAberration: boolean;
  // How many pixels the channels are pulled apart.
  chromaticAberrationStrength: number;
  // The glow just inside the edge. Its colour is the --liquid-glass-glow-color custom
  // property, white by default, read wherever the element sits.
  glow: boolean;
  // How far the glow reaches into the element, in pixels.
  glowSize: number;
  // The glow's opacity at the very edge, from 0 to 1.
  glowStrength: number;
};

export const defaultConfig: Readonly<GlassConfig> = {
  distortion: 'auto',
  brightness: 1.1,
  chromaticAberration: false,
  chromaticAberrationStrength: 1,
  glow: true,
  glowSize: 8,
  glowStrength: 0.1
};

let config: GlassConfig = { ...defaultConfig };
const listeners = new Set<() => void>();

export function getConfig(): Readonly<GlassConfig> {
  return config;
}

// Changes the settings for every glass element, which update at once.
export function configure(changes: Partial<GlassConfig>) {
  config = { ...config, ...changes };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Only Chromium can draw an SVG filter inside backdrop-filter. Elsewhere the
// declaration still parses, but nothing is drawn, blur included. There is no
// feature test for it (CSS.supports says yes), so this asks for userAgentData,
// which only Chromium has. Revisit when Firefox or Safari catch up.
export function supportsDistortion() {
  return typeof navigator !== 'undefined' && 'userAgentData' in navigator;
}

export function distortionEnabled() {
  return config.distortion === 'auto' ? supportsDistortion() : config.distortion;
}
