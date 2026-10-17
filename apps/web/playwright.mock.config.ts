import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra o mock em memória do Supabase (e2e/mock-supabase/server.mjs) — nunca toca um Supabase real.
 * Sobe o mock + build de produção (`next start`) no modo Finanças.
 */
const MOCK_PORT = 54329;
const APP_PORT = 3105;

const appEnv = {
  APP_MODE: 'financas',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
  NEXT_PUBLIC_SENTRY_DSN: '',
  NEXT_TELEMETRY_DISABLED: '1',
};

const iPhone = devices['iPhone 13'];

export default defineConfig({
  testDir: './e2e',
  testMatch: /(modo-runtime|novo-usuario|onboarding-loop)\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './e2e/artifacts/test-results',

  use: {
    ...iPhone,
    // localhost (não 127.0.0.1): o `next start` monta os redirects do middleware com "localhost";
    // com outro host os cookies de sessão não acompanham o redirect.
    baseURL: `http://localhost:${APP_PORT}`,
    // A CSP de produção só libera *.supabase.co; o mock é http://127.0.0.1. Contorna só no navegador do teste.
    bypassCSP: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'iphone13-webkit', use: { ...iPhone, browserName: 'webkit' } }],

  webServer: [
    {
      command: `node e2e/mock-supabase/server.mjs ${MOCK_PORT}`,
      url: `http://127.0.0.1:${MOCK_PORT}/__mock/health`,
      reuseExistingServer: false,
      timeout: 15_000,
      stdout: 'pipe',
    },
    {
      // Sempre rebuilda: um .next antigo pode ter a URL/chave do Supabase real embutida no bundle.
      // Build sem APP_MODE e start com APP_MODE=financas: prova que o modo é lido em runtime (e2e/modo-runtime.spec.ts).
      command: `env -u APP_MODE pnpm exec next build && pnpm exec next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      env: appEnv,
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: 'pipe',
    },
  ],
});
