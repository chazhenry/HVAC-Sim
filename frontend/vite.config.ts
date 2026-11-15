import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        // Dev only: the API's sign-in check trusts http://localhost:5173. When this dev server is opened
        // from another device (e.g. an iPad at http://192.168.x.x:5173) or on another port, present its own
        // pages as that trusted origin. Requests from any other site keep their real Origin and stay blocked.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const { origin, host } = req.headers;
            try {
              if (origin && host && new URL(origin).host === host) proxyReq.setHeader('origin', 'http://localhost:5173');
            } catch {
              // Malformed Origin: forward it unchanged and let the API refuse it.
            }
          });
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
