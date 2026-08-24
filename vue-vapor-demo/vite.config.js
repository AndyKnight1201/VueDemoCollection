import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        dashboard: fileURLToPath(new URL('./index.html', import.meta.url)),
        vdom: fileURLToPath(new URL('./vdom.html', import.meta.url)),
        vapor: fileURLToPath(new URL('./vapor.html', import.meta.url)),
      },
    },
  },
})
