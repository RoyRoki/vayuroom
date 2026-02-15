import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    plugins: [
        react(),
        basicSsl(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
                name: 'Vayuroom',
                short_name: 'Vayuroom',
                description: 'Ephemeral, encrypted chat & video calls. No login, no history, no tracking.',
                theme_color: '#000000',
                icons: [
                    {
                        src: 'pwa-192x192.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: 'pwa-512x512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    },
                    {
                        src: 'pwa-512x512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
})
