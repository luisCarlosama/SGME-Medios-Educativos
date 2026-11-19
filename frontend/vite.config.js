
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'bluish-underwent-proven.ngrok-free.dev',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
