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
  // Regenerate the Tailwind stylesheet as part of every build. `clean: true`
  // wipes dist/ on each (re)build, so if the CSS isn't tied to the tsup run it
  // silently disappears and consumers hit "Can't resolve .../styles.css". This
  // hook runs after each successful build, including in watch mode.
  onSuccess: 'tailwindcss -i ./src/globals.css -o ./dist/styles.css --minify',
});
