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
              // Розділити Three.js окремо (найбільша бібліотека)
              'three-core': ['three'],
              // Recharts для графіків
              'charts': ['recharts'],
              // React vendor bundle
              'react-vendor': ['react', 'react-dom'],
            },
            // Оптимізовані назви файлів
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
        // Збільшити ліміт попередження
        chunkSizeWarningLimit: 600,
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'three'],
      },
    };
});
