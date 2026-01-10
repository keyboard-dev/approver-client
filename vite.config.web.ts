/**
 * Vite Configuration for Web Build
 *
 * This configuration builds the app for deployment as a standalone web application.
 * It differs from the Electron config in several ways:
 * - Different output directory (dist-web instead of public/dist)
 * - Includes web initialization
 * - Sets VITE_PLATFORM=web environment variable
 */

import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: './src/renderer',
  base: '/',
  envDir: path.resolve(__dirname, '.'),
  define: {
    // Set platform to web
    'import.meta.env.VITE_PLATFORM': JSON.stringify('web'),
  },
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Generate source maps for debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  optimizeDeps: {
    include: ['react-router-dom'],
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces (makes it accessible via localhost and 127.0.0.1)
    port: 8082,
    open: 'http://127.0.0.1:8082/',
    proxy: {
      // Proxy API requests to the backend during development
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 8082,
  },
})
