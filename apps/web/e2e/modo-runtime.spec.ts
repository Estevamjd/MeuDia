import { test, expect } from './mock-guard';

// O build do mock roda SEM APP_MODE e o servidor sobe COM APP_MODE=financas (playwright.mock.config.ts).
// Se o layout raiz voltar a ser pré-renderizado no build, o modo congela em "padrao" e este teste falha (bug do PR #10).
test('/login entrega o modo financas lido em runtime', async ({ request }) => {
  const res = await request.get('/login');
  expect(res.status(), 'GET /login').toBe(200);
  const html = await res.text();
  expect(html, 'HTML do /login contém mode":"financas"').toMatch(/mode\\?":\\?"financas/);
  expect(html, 'HTML do /login não contém mode":"padrao"').not.toMatch(/mode\\?":\\?"padrao/);
});
