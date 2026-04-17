import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path is /startstreken/ when building on GitHub Actions, / otherwise.
// This allows the same build to work both locally and on GitHub Pages.
const base = process.env.GITHUB_ACTIONS ? '/startstreken/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Startstreken',
        short_name: 'Startstreken',
        description: 'Sjekk været langs ruten for norske sykkelritt og langrenn.',
        theme_color: '#aa3bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 48, // 48 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    open: true,
  },
})
