import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    // 编辑器/工具常用「写临时文件再原子替换」保存文件。
    // Windows 上 FSWatcher 会去 watch 这些瞬时临时文件并抛 EBUSY，
    // 直接让 dev server 崩溃。忽略它们即可，源码热更新不受影响。
    watch: {
      ignored: [
        '**/.*.tmpdir/**',
        '**/*.tmp',
        '**/*.tmpdir/**',
        '**/.~*',
        '**/*~',
      ],
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:5181', changeOrigin: true },
      '/images': { target: 'http://127.0.0.1:5181', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 8000 },
})
