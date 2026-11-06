import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/habits/' : '/',
  define: {
    'import.meta.env.VITE_STORAGE_MODE': JSON.stringify(mode === 'pages' ? 'browser' : 'server'),
  },
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3333' } },
  },
}))
