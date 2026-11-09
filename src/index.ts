import { isRunning } from './auto';

export * from './core';

// Before 0.2.0, importing the package started it. Anyone still relying on that would just stop seeing
// glass, with nothing to say why. So, once the page has had time to render, say so (once) if there are
// glass elements and start() has not been called. This only reads the page; it never changes it, and
// it does nothing on the server.
if (typeof window !== 'undefined') {
  window.setTimeout(() => {
    if (!isRunning() && document.querySelector('[data-liquid-glass]')) {
      console.warn(
        '[liquid-glass] This page has data-liquid-glass elements, but start() has not been called, so they ' +
          'are plain. Importing the package no longer starts it (since 0.2.0): call start() once the page is ' +
          'ready. See https://gabrielfins.github.io/liquid-glass/#usage'
      );
    }
  }, 1500);
}
