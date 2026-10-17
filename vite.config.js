import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// Normal build: multi-page (app + dev harnesses).
// SINGLE=1: one self-contained index.html for previews (no external files).
const single = !!process.env.SINGLE;

export default defineConfig({
  base: './',
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  plugins: single ? [viteSingleFile()] : [],
  build: single
    ? { target: 'es2022', assetsInlineLimit: 100000000, cssCodeSplit: false }
    : {
        target: 'es2022',
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
            city: resolve(__dirname, 'city.html'),
            mission: resolve(__dirname, 'mission.html'),
          },
        },
      },
});
