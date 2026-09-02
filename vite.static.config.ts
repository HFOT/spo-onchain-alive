import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

// The static build, for GitHub Pages.
//
// The app fetches the relay-health dataset directly from the browser, so there
// is nothing left for a server to do and the whole site can be written as files.
// This config builds that: `static/index.html` as the entry, everything bundled,
// output to `dist-static`.
//
// `base` has to be relative. Project Pages are served from a subpath
// (/spo-onchain-alive/), and absolute asset URLs would resolve to the domain
// root and 404 there.
export default defineConfig({
  base: './',
  root: 'static',
  publicDir: '../public',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: {
    outDir: '../dist-static',
    emptyOutDir: true,
  },
});
