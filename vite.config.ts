import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build' || mode === 'production';
  const analyze = process.env.ANALYZE === 'true' || mode === 'analyze';
  const securityHeaders = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  } as const;
  const serverConfig = !isProduction ? { 
    headers: securityHeaders,
    host: '127.0.0.1', // Force IPv4 for Windows compatibility
  } : undefined;
  const previewConfig = isProduction ? { headers: securityHeaders } : undefined;

  return {
    plugins: [
      react(),
      // Add compression for production builds
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        deleteOriginFile: false,
        // Only compress in production
        disable: !isProduction,
      }),
      analyze &&
        visualizer({
          filename: 'dist/bundle-analysis.html',
          title: 'CMSNext Bundle Analysis',
          template: 'treemap',
          brotliSize: true,
          gzipSize: true,
          emitFile: true,
        }),
    ].filter(Boolean),
    base: '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    server: serverConfig,
    preview: previewConfig,
    build: {
      sourcemap: true,
      rollupOptions: {
        external: (id) => {
          // Only exclude docs/development/archive directory (old roadmaps), not domain/archive or types/archive
          return id.includes('/docs/development/archive/');
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
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-toggle',
              '@radix-ui/react-toggle-group',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-aspect-ratio',
            ],
            // Utility libraries
            utils: ['sonner', 'date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          },
        },
      },
      // Increase chunk size warning limit for optimized chunks
      chunkSizeWarningLimit: 1000,
      target: 'esnext',
      // Enable terser minification in production
      minify: 'terser',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'sonner', 'clsx', 'tailwind-merge', 'class-variance-authority'],
    },
  }
})