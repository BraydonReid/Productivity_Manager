import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { build } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'build-content-script',
      async writeBundle() {
        // Build content script separately as IIFE (no ES module imports)
        await build({
          configFile: false,
          build: {
            outDir: resolve(__dirname, 'dist'),
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/content/content-script.ts'),
              formats: ['iife'],
              name: 'ContentScript',
              fileName: () => 'content-script.js',
            },
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          },
        });

        // Copy manifest.json to dist
        copyFileSync(
          resolve(__dirname, 'public/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
        // Copy icons
        try {
          mkdirSync(resolve(__dirname, 'dist/icons'), { recursive: true });
          cpSync(
            resolve(__dirname, 'public/icons'),
            resolve(__dirname, 'dist/icons'),
            { recursive: true }
          );
        } catch {}
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'service-worker.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
