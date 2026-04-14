import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH controls where the app is hosted:
//   GitHub Pages:  /T3Code-Lens/
//   Self-hosted:   /              (default when env var is absent)
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      // even-toolkit and its SDK are provided by the Even Hub WebView at
      // runtime. They must not be bundled — mark them as external.
      external: (id) =>
        (id === '@evenrealities/even_hub_sdk' ||
         id === 'even-toolkit' ||
         id.startsWith('even-toolkit/')) &&
        !id.endsWith('.css'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
