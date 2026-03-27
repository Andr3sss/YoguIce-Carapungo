import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0', // Permite que otros dispositivos en el mismo WiFi se conecten
    port: 3000,
    open: false,
  },
  plugins: []
});
