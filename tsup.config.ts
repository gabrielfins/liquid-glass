import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // The entries share one copy of the core, so configure() reaches glass made
  // through either of them. Only the main entry starts the data attributes.
  splitting: true,
  target: 'es2022'
});
