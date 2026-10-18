import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const DIA = 24 * 60 * 60

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Íconos (incluido el "maskable" de Android) generados desde un solo SVG.
      pwaAssets: { image: 'public/icono.svg', preset: 'minimal-2023', overrideManifestIcons: true },
      manifest: {
        name: 'Muro Rally',
        short_name: 'Muro Rally',
        description: 'Los videos de los aficionados, ordenados por tramo, km y auto.',
        lang: 'es-419',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#f9fafb',
      },
      workbox: {
        // Caché del app shell para el aficionado. Quedan fuera MapLibre (~1 MB, se guarda
        // recién si se abre un mapa) y las pantallas del equipo, que los aficionados no usan.
        // Sin webmanifest: el plugin ya lo agrega, y repetido rompe todo el precache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: [
          '**/mapaBase-*',
          '**/PaginaAdmin-*',
          '**/PaginaEventoAdmin-*',
          '**/PaginaEquipo-*',
          '**/PaginaModeracion-*',
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/(mapaBase-|maplibre-gl-worker-)/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'mapa-libreria', expiration: { maxEntries: 4 } },
          },
          {
            // Teselas: cache moderada (spec §10: sin caché agresiva de teselas ni API).
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'teselas',
              expiration: { maxEntries: 300, maxAgeSeconds: 3 * DIA },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'i.ytimg.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'miniaturas',
              expiration: { maxEntries: 150, maxAgeSeconds: DIA },
            },
          },
          // La API de Supabase no se cachea: el muro y la moderación necesitan datos frescos.
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Código compartido con las Edge Functions (sin dependencias de Deno ni del navegador).
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  build: {
    // MapLibre (~1 MB) va en un chunk propio que se descarga solo al abrir un mapa.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
    css: false,
  },
})
