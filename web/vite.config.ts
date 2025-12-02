import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function oroioDataPlugin() {
  return {
    name: 'oroio-data',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/data/')) {
          const fileName = req.url.replace('/data/', '')
          const filePath = path.join(homedir(), '.oroio', fileName)
          
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res)
          } else {
            res.statusCode = 404
            res.end('Not found')
          }
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), oroioDataPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
