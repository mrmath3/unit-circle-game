import { defineConfig } from 'vite';

export default defineConfig({
  // './' keeps asset paths relative so the build works on GitHub Pages
  // AND on a website subdirectory like /games/unit-circle/ without changes
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
