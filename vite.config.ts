import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/T3Code-Lens/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // even-toolkit and its SDK are provided by the Even Hub WebView at
      // runtime. They must not be bundled — mark them as external.
      external: [
        'even-toolkit/glasses',
        'even-toolkit/stt',
        '@evenrealities/even_hub_sdk',
      ],
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
