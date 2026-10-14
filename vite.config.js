import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// Serve /game (no trailing slash) as the game page in dev, like static hosts do.
const gameRoute = () => ({
  name: 'blockvale-game-route',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/game' || req.url?.startsWith('/game?')) {
        res.statusCode = 301
        res.setHeader('Location', req.url.replace('/game', '/game/'))
        res.end()
        return
      }
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gameRoute()],
  server: {
    proxy: {
      "/api": "http://localhost:5174",
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        game: resolve(root, 'game/index.html'),
      },
    },
  },
})
