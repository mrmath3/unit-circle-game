import { defineConfig } from 'vite';

export default defineConfig({
  base: '/unit-circle-game/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
