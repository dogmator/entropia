import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'src/ui',
    publicDir: '../../public',
    envDir: '..',
    base: '/entropia/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        usePolling: true,
      },
      hmr: {
        clientPort: 3000,
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@core': path.resolve(__dirname, './src/core'),
        '@simulation': path.resolve(__dirname, './src/simulation'),
        '@ui': path.resolve(__dirname, './src/ui'),
      }
    },
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
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
