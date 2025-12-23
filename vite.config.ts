import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/entropia/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      target: 'es2015',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            /** Відокремлення ядра Three.js для оптимізації кешування (найбільший програмний вузол). */
            'three-core': ['three'],
            /** Пакет бібліотеки Recharts для візуалізації аналітичних даних. */
            'charts': ['recharts'],
            /** Базові бібліотеки React (Vendor bundle). */
            'react-vendor': ['react', 'react-dom'],
          },
          /** Детерміновані паттерни іменування артефактів збірки. */
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      /** Корекція порогу попередження щодо обсягу кодових чанків. */
      chunkSizeWarningLimit: 600,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'three'],
    },
  };
});
