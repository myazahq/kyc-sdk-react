import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  banner: { js: '"use client";' },
  esbuildOptions(options) {
    options.loader = { ...options.loader, '.gif': 'dataurl' };
  },
});
