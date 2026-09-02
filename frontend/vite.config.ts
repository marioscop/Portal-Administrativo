import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(process.env.VITE_BASIC_SSL === '1' ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5173,
    https:
      process.env.VITE_HTTPS_KEY && process.env.VITE_HTTPS_CERT
        ? {
            key: fs.readFileSync(process.env.VITE_HTTPS_KEY),
            cert: fs.readFileSync(process.env.VITE_HTTPS_CERT),
          }
        : process.env.VITE_BASIC_SSL === '1'
          ? {}
          : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
})
