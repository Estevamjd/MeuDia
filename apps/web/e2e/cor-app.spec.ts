import { devices, type Browser, type Page, type Route } from '@playwright/test';
import { test, expect } from './mock-guard';
import { vigiarErros } from './vigia-erros';

/**
 * Cor do app (Configurações › Aparência), iPhone 13 contra o mock do Supabase: vale na hora, nasce com a cor
 * ao recarregar (data-accent antes da hidratação), pinta o botão primário, fica salva na conta e volta ao Ciano.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const APP_URL = 'http://localhost:3105';
const SENHA = 'senhaForte123';
const email = `cor.${Date.now().toString(36)}@example.test`;
const accentInicial = (page: Page) => page.evaluate(() => (window as unknown as { __accentInicial?: string | null }).__accentInicial);

async function corDaConta(): Promise<unknown> {
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  return estado.users.find((u: { email: string }) => u.email === email)?.user_metadata?.cor_app;
}

/**
 * Abre `url` num aparelho "recém-aberto" (contexto novo com os cookies e o localStorage desta página, sem service
 * worker ainda, que serviria /_next/static do cache por fora do route) com todo JS do app (/_next/static/chunks)
 * retido: o que aparece veio só do HTML, do CSS e do SCRIPT_TEMA no <head>, sem React. Fecha o contexto sem soltar.
 */
async function pinturaSemReact(browser: Browser, page: Page, url: string) {
  const contexto = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: APP_URL,
    bypassCSP: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    storageState: await page.context().storageState(),
  });
  try {
    // Mesma barreira do mock-guard: nada de Supabase real.
    await contexto.route(/https?:\/\/[^/]*\.supabase\.(co|in|net)\//, (route) => route.abort());
    const presos: Route[] = [];
    await contexto.route('**/_next/static/chunks/**', (route) => {
      presos.push(route); // nunca respondido: o React não roda nesta página
    });
    const nova = await contexto.newPage();
    await nova.goto(url, { waitUntil: 'commit' });
    // Os chunks têm de passar pelo route (se viessem de outro cache, isto falharia em vez de passar).
    await expect.poll(() => presos.length).toBeGreaterThan(0);
    // O CSS (/_next/static/css) não fica retido: espera a folha aplicar (--bg só existe nela) antes de ler.
    await expect
      .poll(() => nova.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()))
      .not.toBe('');
    return await nova.evaluate(() => ({
      accent: document.documentElement.getAttribute('data-accent'),
      varAccent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      cAccent: getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
      // Prova de que nada do app rodou: o Next marca a hidratação em window.next.
      semReact: !(window as unknown as { next?: unknown }).next,
    }));
  } finally {
    await contexto.close();
  }
}

async function fecharBannerInstalar(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

test('Cor do app: Laranja vale na hora, não pisca ao recarregar, pinta o botão primário e volta ao Ciano', async ({ browser, page }) => {
  // Só tolera o cancelamento do WebKit entregue durante um goto do próprio teste (ver e2e/vigia-erros.ts).
  const vigia = await vigiarErros(page);
  // Registra o data-accent no DOMContentLoaded, antes do React: prova que a cor nasce certa.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { __accentInicial?: string | null }).__accentInicial = document.documentElement.getAttribute('data-accent');
    });
  });

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Cor Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('30000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBannerInstalar(page);

  // Sem escolha: ciano de sempre (sem atributo), botão primário #00e5ff.
  const gastei = page.getByRole('button', { name: 'Gastei' }).first();
  await expect(gastei).toHaveCSS('background-color', 'rgb(0, 229, 255)');
  expect(await accentInicial(page)).toBeNull();

  await page.goto('/configuracoes');
  const grupo = page.getByRole('radiogroup', { name: 'Cor do app' });
  await expect(grupo.getByRole('radio', { name: 'Ciano' })).toHaveAttribute('aria-checked', 'true');
  const laranja = grupo.getByRole('radio', { name: 'Laranja' });
  const caixa = await laranja.boundingBox();
  expect(caixa && Math.min(caixa.width, caixa.height)).toBeGreaterThanOrEqual(44);
  await laranja.click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'laranja');
  await expect(laranja).toHaveAttribute('aria-checked', 'true');
  // Barra do PWA continua o fundo.
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#050a16');

  // Salvo na conta antes de sair da tela (a gravação é assíncrona).
  await expect.poll(corDaConta).toBe('laranja');

  // Recarregar: já nasce laranja, com o JS do app retido (sem React): data-accent e a variável CSS já valem.
  const pintura = await pinturaSemReact(browser, page, '/financas');
  expect(pintura.semReact).toBe(true);
  expect(pintura.accent).toBe('laranja');
  expect(pintura.varAccent).toBe('#fb923c');
  expect(pintura.cAccent).toBe('251 146 60');
  // E na página de verdade: o data-accent já estava no DOMContentLoaded e o botão primário fica laranja.
  await page.goto('/financas');
  expect(await accentInicial(page)).toBe('laranja');
  await expect(gastei).toHaveCSS('background-color', 'rgb(251, 146, 60)');
  await expect(gastei).toHaveCSS('color', 'rgb(6, 16, 28)');

  // Volta ao Ciano: sem atributo e o visual de sempre.
  await page.goto('/configuracoes');
  await grupo.getByRole('radio', { name: 'Ciano' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.+/);
  await expect.poll(corDaConta).toBe('ciano');
  const ciano = await pinturaSemReact(browser, page, '/configuracoes');
  expect(ciano.semReact).toBe(true);
  expect(ciano.accent).toBeNull();
  expect(ciano.varAccent).toBe('#00e5ff');
  await page.goto('/financas');
  await expect(gastei).toHaveCSS('background-color', 'rgb(0, 229, 255)');

  expect(vigia.erros(), vigia.relatorio()).toEqual([]);
});
