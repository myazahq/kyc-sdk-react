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
  // Bundled rather than left as a runtime dependency. It is a tiny, zero-dep
  // encoder, and inlining it means a consumer does not have to install anything
  // to render a QR — the SDK is a drop-in component library, so every extra
  // install step is a support ticket waiting to happen.
  noExternal: ['qrcode-generator'],
  banner: { js: '"use client";' },
  esbuildOptions(options) {
    // The compiled Tailwind sheet (src/generated/styles.css.txt, built BEFORE
    // tsup by the build/dev scripts) is bundled as a raw string for the
    // SdkFrame shadow roots — the SDK styles itself without a global
    // stylesheet import. `.txt`, NOT `.css`: tsup's own CSS pipeline
    // intercepts `.css` imports ahead of this loader map and emits an empty
    // module (`var styles_default = {}`), silently unstyling the shadow roots.
    options.loader = { ...options.loader, '.gif': 'dataurl', '.txt': 'text' };
  },
  // dist/styles.css is a copy of the pre-built sheet, refreshed per build.
  // `clean: true` wipes dist/ on each (re)build, so if the CSS isn't tied to
  // the tsup run it silently disappears and consumers hit "Can't resolve
  // .../styles.css". This hook runs after each successful build, including in
  // watch mode.
  onSuccess: 'cp ./src/generated/styles.css.txt ./dist/styles.css',
});
