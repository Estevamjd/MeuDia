import fs from 'node:fs';
import path from 'node:path';
import type { Page, Locator } from '@playwright/test';
import { test, expect } from './mock-guard';

/**
 * Auditoria E2E de um usuário NOVO no modo Finanças (iPhone 13 / WebKit),
 * contra o mock em memória do Supabase. Rode com `pnpm e2e:mock`.
 */

const ARTIFACTS = path.join(__dirname, 'artifacts', 'onboarding-loop');
const MOCK_URL = 'http://127.0.0.1:54329';

const run = Date.now().toString(36);
const NOME = 'Maria Teste';
const EMAIL = `maria.${run}@example.test`;
const SENHA = 'senhaForte123';

interface Problema {
  tipo: 'pageerror' | 'console' | 'requestfailed' | 'http';
  url?: string;
  texto: string;
  passo: string;
}

test.describe.configure({ mode: 'serial' });

test('onboarding sem loop: cadastro → onboarding → home', async ({ page }) => {
  fs.rmSync(ARTIFACTS, { recursive: true, force: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  let passoAtual = '00-inicio';
  let n = 0;
  const shot = async (nome: string) => {
    n += 1;
    passoAtual = `${String(n).padStart(2, '0')}-${nome}`;
    await page.screenshot({ path: path.join(ARTIFACTS, `${passoAtual}.png`), fullPage: true });
  };

  // ── Coleta de erros ────────────────────────────────────────────────────────
  const problemas: Problema[] = [];
  page.on('pageerror', (err) => problemas.push({ tipo: 'pageerror', texto: `${err.name}: ${err.message}\n${err.stack ?? ''}`, passo: passoAtual }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problemas.push({ tipo: 'console', texto: msg.text(), url: msg.location().url, passo: passoAtual });
  });
  page.on('requestfailed', (req) => {
    const motivo = req.failure()?.errorText ?? '';
    // Navegações/prefetch canceladas pelo próprio app (troca de rota) não são falhas.
    if (/cancel|abort/i.test(motivo)) return;
    problemas.push({ tipo: 'requestfailed', url: req.url(), texto: `${req.method()} ${motivo}`, passo: passoAtual });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      problemas.push({ tipo: 'http', url: res.url(), texto: `${res.request().method()} ${res.status()}`, passo: passoAtual });
    }
  });

  /** Digita tecla a tecla e garante que o foco não sai do campo em nenhum momento. */
  const digitarComFoco = async (campo: Locator, texto: string) => {
    await campo.click();
    await expect(campo).toBeFocused();
    for (const ch of texto) {
      await campo.press(ch === ' ' ? 'Space' : ch);
      await expect(campo, `foco perdido ao digitar "${ch}"`).toBeFocused();
    }
  };

  const semVoltarParaOnboarding = async (p: Page, ms = 5_000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      expect(new URL(p.url()).pathname, 'voltou para /onboarding').not.toMatch(/^\/onboarding/);
      await p.waitForTimeout(250);
    }
  };

  /** Rola o alvo para o centro (como o usuário faria, acima da BottomNav fixa) e toca. */
  const tocar = async (alvo: Locator) => {
    await alvo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await alvo.click();
  };

  /** Confere o toast e o fecha (fica acima dos modais por design e cobriria o próximo formulário). */
  const confirmarToast = async (texto: string) => {
    const alerta = page.getByRole('alert').filter({ hasText: texto });
    await expect(alerta).toBeVisible();
    await alerta.getByRole('button', { name: 'Fechar notificação' }).click();
    await expect(alerta).toBeHidden();
  };
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });

  // ── 1. Cadastro ────────────────────────────────────────────────────────────
  await page.goto('/registro');
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
  await shot('registro');

  await page.getByLabel('Nome').fill(NOME);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await shot('registro-preenchido');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // ── 2. Onboarding ──────────────────────────────────────────────────────────
  await page.waitForURL(/\/onboarding/);
  const campoNome = page.getByLabel('Como podemos te chamar?');
  await expect(campoNome).toBeVisible();
  await expect(campoNome).toHaveValue(NOME); // vem do user_metadata
  await shot('onboarding');

  await campoNome.fill('');
  await digitarComFoco(campoNome, 'Mari');
  await shot('onboarding-nome');
  // 2º passo (opcional): "Onde fica seu dinheiro?" — em branco, a usuária cadastra depois.
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Onde fica seu dinheiro?' })).toBeVisible();
  await shot('onboarding-carteiras');
  await page.getByRole('button', { name: 'Concluir' }).click();

  await page.waitForURL(/\/financas$/);
  await semVoltarParaOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Finanças', level: 1 })).toBeVisible();
  await shot('financas-apos-onboarding');

  const perfil = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const prof = perfil.tables.profiles.find((p: { email: string }) => p.email === EMAIL);
  expect(prof.onboarding_feito).toBe(true);
  expect(prof.nome).toBe('Mari');

  // Voltar do navegador não pode cair em loop de onboarding.
  await page.goBack();
  await page.waitForLoadState('load');
  await semVoltarParaOnboarding(page);
  await shot('apos-voltar');
  if (!/\/financas$/.test(page.url())) await page.goto('/financas');
  await page.reload();
  await semVoltarParaOnboarding(page, 3_000);

  // ── 3. Home: boas-vindas + renda ───────────────────────────────────────────
  const boasVindas = page.getByRole('region', { name: /Vamos montar seu mês|Agora, suas contas/ });
  await expect(boasVindas).toBeVisible();
  await expect(page.getByText('Passo 1 de 2')).toBeVisible();
  await shot('home-novo-usuario');
  expect(problemas.filter((p) => p.tipo === 'pageerror'), JSON.stringify(problemas, null, 1)).toEqual([]);
});
