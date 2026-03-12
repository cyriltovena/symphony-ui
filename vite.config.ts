import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { observabilityLocalApiMiddleware } from './vite.observability-local'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'observability-local-api',
      configureServer(server) {
        server.middlewares.use(observabilityLocalApiMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(observabilityLocalApiMiddleware())
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4041',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
