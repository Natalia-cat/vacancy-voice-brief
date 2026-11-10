import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — сайт работает из любой подпапки GitHub Pages (username.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [react()],
})
