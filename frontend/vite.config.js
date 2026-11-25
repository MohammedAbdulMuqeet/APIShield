import { defineConfig } from 'vite'

const backend = 'http://127.0.0.1:' + (process.env.PORT || 3001)
export default defineConfig({
  server: { proxy: { '/api': backend, '/gateway': backend } },
})
