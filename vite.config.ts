import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add compression for production builds
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
      // Only compress in production
      disable: process.env.NODE_ENV !== 'production',
    })
  ],
  base: process.env.NODE_ENV === 'production' ? '/CMSNext/' : '/',
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
  server: {
    // Add security headers for development
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: (id) => {
        // Only exclude archive directory, but include scripts for SeedDataGenerator
        return id.includes('/archive/');
      },
      output: {
        manualChunks: {
          // Keep React together and stable
          'react-vendor': ['react', 'react-dom'],
          // UI libraries together
          'ui-vendor': [
            'lucide-react',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu', 
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-aspect-ratio'
          ],
          // Utility libraries
          'utils': ['sonner', 'date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority']
        }
      }
    },
    // Increase chunk size warning limit for optimized chunks
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    // Enable terser minification in production
    minify: 'terser'
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      'class-variance-authority'
    ]
  }
})