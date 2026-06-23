import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/complex-vector-field-visualizer/',
  plugins: [react(), tailwindcss()],
})
