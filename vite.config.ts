import react from '@vitejs/plugin-react';
import path from 'path';
import type { ViteDevServer } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';

const SERVER_CONFIG = {
  port: 3000,
  host: '0.0.0.0',
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
  watch: {
    usePolling: true,
  },
  hmr: {
    clientPort: 3000,
  },
};

const BUILD_CONFIG = {
  outDir: '../../dist',
  emptyOutDir: true,
  target: 'es2015',
  minify: 'terser' as const,
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  },
  rollupOptions: {
    output: {
      manualChunks: {
        'three-core': ['three'],
        'charts': ['recharts'],
        'react-vendor': ['react', 'react-dom'],
      },
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash].[ext]',
    },
  },
  chunkSizeWarningLimit: 600,
};

const RESOLVE_CONFIG = {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@shared': path.resolve(__dirname, './src/shared'),
    '@core': path.resolve(__dirname, './src/core'),
    '@simulation': path.resolve(__dirname, './src/simulation'),
    '@ui': path.resolve(__dirname, './src/ui'),
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'src/ui',
    publicDir: '../../public',
    envDir: '..',
    base: '/entropia/',
    server: SERVER_CONFIG,
    plugins: [
      react(),
      mode === 'development' && checker({
        typescript: {
          root: path.resolve(__dirname, './'),
          tsconfigPath: 'tsconfig.json',
        },
        eslint: {
          lintCommand: `eslint "${path.resolve(__dirname, './src')}/**/*.{ts,tsx}"`,
          useFlatConfig: true,
        },
      }),
      {
        name: 'configure-response-headers',
        configureServer: (server: ViteDevServer) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            next();
          });
        },
      }
    ].filter(Boolean),
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: RESOLVE_CONFIG,
    build: BUILD_CONFIG,
    optimizeDeps: {
      include: ['react', 'react-dom', 'three'],
    },
  };
});
