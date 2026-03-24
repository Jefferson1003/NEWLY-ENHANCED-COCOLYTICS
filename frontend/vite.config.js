import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 7904,
    strictPort: true,
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Cocolytics Enhanced',
        short_name: 'Cocolytics',
        description: 'Installable Vue frontend for Cocolytics.',
        theme_color: '#0f766e',
        background_color: '#f7fdfb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
})
