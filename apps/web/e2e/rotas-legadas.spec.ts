import { test, expect } from './mock-guard';

// Módulos do antigo modo padrão saíram do código (20/11/2026). URL antiga (favorito, atalho do PWA instalado,
// notificação velha), com ou sem subcaminho, vai para /financas com 307, nunca 404.
const LEGADAS = [
  '/inicio',
  '/agenda',
  '/habitos/hoje',
  '/notas',
  '/compras/lista-1',
  '/medicamentos',
  '/veiculo/abc/manutencoes',
  '/dieta?data=2026-11-19',
];

test('sem sessão: toda rota legada responde 307 para /financas', async ({ request }) => {
  for (const rota of LEGADAS) {
    const res = await request.get(rota, { maxRedirects: 0 });
    expect(res.status(), `GET ${rota}`).toBe(307);
    expect(new URL(res.headers()['location']!, 'http://x').pathname, `Location de ${rota}`).toBe('/financas');
  }
  // As rotas de Saúde com o mesmo nome continuam vivas (não confundir /saude/dieta com /dieta).
  const dieta = await request.get('/saude/dieta', { maxRedirects: 0 });
  expect(dieta.headers()['location'] ?? '', '/saude/dieta não vai para /financas').not.toMatch(/\/financas$/);
});

test('logado: abrir /agenda e /habitos/x no navegador termina na Início de Finanças', async ({ page }) => {
  const email = `legado.${Date.now().toString(36)}@example.test`;
  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Rota Legada');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123');
  await page.getByLabel('Confirmar senha').fill('senhaForte123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);

  for (const rota of ['/agenda', '/habitos/x']) {
    const res = await page.request.get(rota, { maxRedirects: 0 });
    expect(res.status(), `GET ${rota} logado`).toBe(307);
    expect(new URL(res.headers()['location']!, 'http://x').pathname).toBe('/financas');
  }
});
