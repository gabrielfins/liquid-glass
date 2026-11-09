import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // The entries share one copy of the core, so configure() reaches glass made
  // through either of them. Both export the same API; the main entry adds a
  // one-time warning for pages that still rely on the old auto-start.
  splitting: true,
  target: 'es2022'
});
