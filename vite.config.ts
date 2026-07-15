import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 等のサブパス配信も見据えて相対パスで出力
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5180, open: true },
});
