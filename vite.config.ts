import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'esnext',
  },
  // Keep dependency pre-bundling on ESNext so the interactive SVG map and
  // modern React output are transformed as little as possible during dev.
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
