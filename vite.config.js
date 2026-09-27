import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Identifiant du build, injecté à la compilation et affiché dans l'interface
  // (menu profil). Sans cela, impossible de savoir quel code le navigateur
  // exécute réellement quand un cache obsolète sert un vieux bundle : on ne
  // voit plus que des symptômes ("ça n'a pas changé") sans cause.
  define: {
    __BUILD_ID__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 19)
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpeg', 'carte.jpeg'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/.*/],
        navigationPreload: false,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hdtyltyxugwtbycnnakb\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Fondation 18 Safar',
        short_name: '18 Safar',
        description: 'Gestion communautaire et solidaire',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    })
  ]
});
