import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@meudia/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@meudia/api': path.resolve(__dirname, 'packages/api/src'),
      '@meudia/ai': path.resolve(__dirname, 'packages/ai/src'),
    },
  },
});
