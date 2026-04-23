import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ADM-042: Single-bundle for production (prevents chunk loading order errors)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        // ADM-042: inlineDynamicImports eliminates chunk loading order issues
        inlineDynamicImports: true,
      },
    },
  },
}));
