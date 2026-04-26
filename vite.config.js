import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      environment: 'jsdom',
      globals: true,
      exclude: ['**/node_modules/**', '**/tests/browser/**'],
    },
    server: {
      port: 3000,
    },
    preview: {
      port: 3000,
    },
    appType: 'spa',
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(
            '%VITE_GA_MEASUREMENT_ID%',
            env.VITE_GA_MEASUREMENT_ID || ''
          );
        },
      },
    ],
  };
});
