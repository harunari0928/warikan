import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiPort = process.env.API_PORT || '3100';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  build: {
    outDir: 'dist/client',
  },
  server: {
    watch: {
      // SQLite ファイル（WAL/SHM 含む）への書き込みでフルリロードが走るのを防ぐ
      ignored: ['**/*.db', '**/*.db-wal', '**/*.db-shm', '**/data/**'],
    },
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
