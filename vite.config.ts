import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// When running inside Tauri, TAURI_DEV_HOST is set by `tauri dev`
const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: __dirname,
  // Prevent Vite from masking Rust errors
  clearScreen: false,
  server: {
    // Tauri needs a fixed port so tauri.conf.json devUrl can reference it
    port: 5173,
    strictPort: true,
    // When running on a mobile device via `tauri dev`, TAURI_DEV_HOST is set
    host: tauriHost || false,
    hmr: tauriHost ? { protocol: 'ws', host: tauriHost, port: 5183 } : undefined,
    watch: {
      // Avoid high CPU on Windows from watching Rust/Cargo output directories
      ignored: ['**/node_modules/**', '**/src-tauri/**'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Pre-cache all build output + static assets
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't cache the remote-sync endpoint if configured
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Large bundles are fine — it's a desktop tooling app, not a phone game
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['tool-icon.svg'],
      manifest: {
        name:        'CNC Tool Converter',
        short_name:  'CNC Tools',
        description: 'Convert, manage, and print CNC tool libraries — works offline.',
        start_url:   '/',
        display:     'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color:      '#1e3560',
        icons: [
          {
            src:     'tool-icon.svg',
            sizes:   'any',
            type:    'image/svg+xml',
            purpose: 'any',
          },
          {
            src:     'tool-icon.svg',
            sizes:   'any',
            type:    'image/svg+xml',
            purpose: 'maskable',
          },
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name:       'Tool Library',
            short_name: 'Library',
            url:        '/?page=tools',
            description: 'Open the tool library directly',
          },
          {
            name:       'Converter',
            short_name: 'Convert',
            url:        '/?page=converter',
            description: 'Open the format converter',
          },
        ],
      },
    }),
  ],
})
