import { defineConfig } from '@playwright/test';
import mock from './playwright.mock.config';

/**
 * Medição de desempenho da troca de abas (e2e/perf/troca-abas.perf.ts). Mesmo mock + build de produção do
 * e2e:mock, mas com latência artificial no mock (MOCK_LATENCY_MS, padrão 150 ms) para simular a rede até o
 * Supabase. Não entra no e2e:mock do CI (testMatch próprio). Uso: `pnpm exec playwright test -c playwright.perf.config.ts`.
 */
const latencia = process.env.MOCK_LATENCY_MS ?? '150';
process.env.MOCK_LATENCY_MS = latencia;
const reusar = process.env.PERF_REUSAR === '1';
type WebServer = NonNullable<Exclude<typeof mock.webServer, unknown[]>>;
const [mockServer, app] = mock.webServer as WebServer[];

export default defineConfig({
  ...mock,
  testDir: './e2e/perf',
  testMatch: /\.perf\.ts$/,
  timeout: 600_000,
  reporter: [['list']],
  outputDir: './e2e/artifacts/perf-results',
  webServer: [
    { ...mockServer!, command: `MOCK_LATENCY_MS=${latencia} ${mockServer!.command}`, reuseExistingServer: reusar },
    // PERF_REUSAR=1: usa mock e `next start` já de pé (mesmas portas), sem rebuild.
    { ...app!, reuseExistingServer: reusar },
  ],
});
