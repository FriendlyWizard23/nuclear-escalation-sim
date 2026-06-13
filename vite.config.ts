import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'esnext',
  },
  // three.js uses top-level await inside react-globe.gl.
  // Vite's dev-server pre-bundles dependencies with esbuild, and esbuild
  // must target a modern environment that supports top-level await, otherwise
  // the page crashes with "Top-level await is not available in the configured
  // target environment".  Setting optimizeDeps.esbuildOptions.target here
  // mirrors the build.target above and fixes that error.
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
