import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      environment: 'jsdom',
      globals: true,
    },
    server: {
      port: 3000,
    },
    plugins: [
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
