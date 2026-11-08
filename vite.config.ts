import { defineConfig } from 'vite';

// The docs site. The library itself is built with tsup (see tsup.config.ts).
export default defineConfig({
  root: 'docs',
  // Relative, so the site works from a GitHub Pages project path.
  base: './',
  build: {
    outDir: '../site',
    emptyOutDir: true
  }
});
