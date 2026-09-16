import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5181', changeOrigin: true },
      '/images': { target: 'http://127.0.0.1:5181', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 8000 },
})
