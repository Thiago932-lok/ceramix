import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        id: '/',
        name: 'Ceramix — Produção e Expedição',
        short_name: 'Ceramix',
        description:
          'Apontamento de produção, controle de refugo e expedição por lote para a indústria cerâmica.',
        lang: 'pt-BR',
        dir: 'ltr',
        scope: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#16231E',
        background_color: '#F4F1EA',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Registrar produção',
            short_name: 'Produção',
            url: '/producao/nova',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }]
          },
          {
            name: 'Nova entrega',
            short_name: 'Entrega',
            url: '/entrega/nova',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }]
          },
          {
            name: 'Painel gerencial',
            short_name: 'Painel',
            url: '/dashboard',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ceramix-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
