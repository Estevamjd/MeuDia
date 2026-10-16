import { test as base, expect } from '@playwright/test';

/** Barreira: nenhum spec com mock pode falar com um Supabase real. Qualquer tentativa aborta e falha o teste. */
export const test = base.extend<{ bloqueioSupabaseReal: void }>({
  bloqueioSupabaseReal: [
    async ({ context }, use) => {
      const tentativas: string[] = [];
      await context.route(/https?:\/\/[^/]*\.supabase\.(co|in|net)\//, (route) => {
        tentativas.push(route.request().url());
        return route.abort();
      });
      await use();
      expect(tentativas, 'requisição para Supabase real bloqueada').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
