import { defineConfig } from 'vite';

export default defineConfig({
  // './' hace que el build funcione en cualquier subcarpeta o hosting estático
  // (itch.io, GitHub Pages, etc.). Cámbialo a '/' si lo sirves desde la raíz.
  base: './',
  server: { port: 5173, open: true },
  build: {
    target: 'esnext', // main.js usa top-level await
    chunkSizeWarningLimit: 1000
  }
});
