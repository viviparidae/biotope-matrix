import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/frontend',
  server: { proxy: { '/simulation': { target: 'ws://localhost:8787', ws: true } } },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});