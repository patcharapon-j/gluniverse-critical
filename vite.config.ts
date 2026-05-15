import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: false,
    outDir: '.',
    lib: {
      entry: resolve(__dirname, 'src/module.ts'),
      formats: ['es'],
      fileName: () => 'module.js',
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css' || assetInfo.name?.endsWith('.css')) {
            return 'styles/module.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
    minify: false,
  },
});
