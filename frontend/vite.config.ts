import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    https:
      process.env.VITE_HTTPS_KEY && process.env.VITE_HTTPS_CERT
        ? {
            key: fs.readFileSync(process.env.VITE_HTTPS_KEY),
            cert: fs.readFileSync(process.env.VITE_HTTPS_CERT),
          }
        : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
})
