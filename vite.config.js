import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
  },
});
