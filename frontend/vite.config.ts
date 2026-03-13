import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  resolve: {
    alias: {
      '../../data.js': resolve(__dirname, './data.js')
    }
  },
  build: {
    outDir: '../viewer',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      external: ['../../data.js']
    }
  },
})
