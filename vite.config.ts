import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/CMSNext/' : '/',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          forms: ['react-hook-form'],
          charts: ['recharts']
        }
      }
    },
    chunkSizeWarningLimit: 250,
    target: 'esnext'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react']
  }
})