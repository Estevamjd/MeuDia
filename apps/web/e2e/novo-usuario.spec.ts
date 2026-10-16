import fs from 'node:fs';
import path from 'node:path';
import type { Page, Locator } from '@playwright/test';
import { test, expect } from './mock-guard';

/**
 * Auditoria E2E de um usuário NOVO no modo Finanças (iPhone 13 / WebKit),
 * contra o mock em memória do Supabase. Rode com `pnpm e2e:mock`.
 */

const ARTIFACTS = path.join(__dirname, 'artifacts', 'novo-usuario');
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

test('novo usuário: cadastro → onboarding → finanças → logout → login', async ({ page }) => {
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

  // Banner "Instalar MeuDia" (iOS, aparece após 2s): não pode cobrir a BottomNav.
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  const caixaBanner = (await banner.boundingBox())!;
  const caixaNav = (await bottomNav.boundingBox())!;
  expect(caixaBanner.y + caixaBanner.height, 'banner de instalação cobre a BottomNav').toBeLessThanOrEqual(caixaNav.y);
  await shot('banner-instalar');

  // Com o banner visível, o modal precisa ficar por cima dele (o clique em "Salvar" prova).
  await tocar(page.getByRole('button', { name: 'Cadastrar minha renda' }));
  const modalRenda = page.getByRole('dialog', { name: 'Sua renda do mês' });
  await expect(modalRenda).toBeVisible();
  const valorRenda = modalRenda.getByLabel('Valor');
  await digitarComFoco(valorRenda, '350000');
  await expect(valorRenda).toHaveValue(/3\.500,00/);
  await digitarComFoco(modalRenda.getByLabel('Dia que recebe (opcional)'), '5');
  await shot('modal-renda');
  await modalRenda.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Renda salva');
  await expect(modalRenda).toBeHidden();
  await expect(page.getByText('Passo 2 de 2')).toBeVisible();
  await shot('renda-salva');
  await banner.getByRole('button', { name: 'Fechar' }).click();
  await expect(banner).toBeHidden();

  // ── 4. Nova conta (foco em todos os campos) ────────────────────────────────
  await tocar(page.getByRole('link', { name: 'Adicionar conta' }));
  await page.waitForURL(/\/financas\/contas/);
  const modalConta = page.getByRole('dialog', { name: 'Nova conta' });
  await expect(modalConta).toBeVisible();
  await shot('modal-nova-conta');

  await digitarComFoco(modalConta.getByLabel('Nome'), 'Luz');
  await digitarComFoco(modalConta.getByLabel('Valor (R$)'), '150.75');
  // Passa por "Anual" para exercitar o campo de mês e por "Única" para a data.
  const recorrencia = modalConta.getByLabel('Recorrência');
  await recorrencia.selectOption('anual');
  await digitarComFoco(modalConta.getByLabel('Mês do vencimento'), '12');
  await recorrencia.selectOption('unica');
  await modalConta.getByLabel('Data do vencimento').fill('2030-01-15');
  await expect(modalConta.getByLabel('Data do vencimento')).toHaveValue('2030-01-15');
  await recorrencia.selectOption('mensal');
  await digitarComFoco(modalConta.getByLabel('Dia do vencimento'), '28');
  const categoria = modalConta.getByLabel('Categoria');
  await categoria.fill('');
  await digitarComFoco(categoria, 'Casa');
  await expect(modalConta.getByLabel('Nome')).toHaveValue('Luz');
  await expect(modalConta.getByLabel('Valor (R$)')).toHaveValue('150.75');
  await shot('nova-conta-preenchida');
  await modalConta.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Conta criada!');
  await expect(modalConta).toBeHidden();
  await expect(page.getByText('Luz', { exact: true })).toBeVisible();
  await shot('conta-criada');

  // ── 5. Paguei ──────────────────────────────────────────────────────────────
  await bottomNav.getByRole('link', { name: 'Início' }).click();
  await page.waitForURL(/\/financas$/);
  const paguei = page.getByRole('button', { name: 'Paguei Luz' });
  await expect(paguei).toBeVisible();
  await expect(page.getByRole('region', { name: /Vamos montar seu mês|Agora, suas contas/ })).toHaveCount(0);
  await shot('home-com-conta');
  await tocar(paguei);
  await confirmarToast('"Luz" marcada como paga.');
  await expect(page.getByText('Todas as contas do mês estão pagas.')).toBeVisible();
  await shot('conta-paga');

  // ── 6. Orçamento ───────────────────────────────────────────────────────────
  await bottomNav.getByRole('link', { name: 'Orçamento' }).click();
  await page.waitForURL(/\/financas\/orcamento/);
  await expect(page.getByRole('heading', { name: 'Orçamento', level: 1 })).toBeVisible();
  await shot('orcamento');
  await tocar(page.getByRole('button', { name: 'Novo limite' }));
  const modalLimite = page.getByRole('dialog');
  await expect(modalLimite).toBeVisible();
  await digitarComFoco(modalLimite.getByLabel('Categoria'), 'Mercado');
  await digitarComFoco(modalLimite.getByLabel('Limite do mês (R$)'), '800');
  await shot('modal-limite');
  await modalLimite.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Limite salvo!');
  await expect(page.getByText('Mercado').first()).toBeVisible();
  await shot('limite-salvo');

  // ── 7. Novo lançamento ─────────────────────────────────────────────────────
  await bottomNav.getByRole('link', { name: 'Início' }).click();
  await page.waitForURL(/\/financas$/);
  await tocar(page.getByRole('button', { name: 'Novo lançamento' }));
  const modalLanc = page.getByRole('dialog', { name: 'Novo lançamento' });
  await expect(modalLanc).toBeVisible();
  await modalLanc.getByLabel('Tipo').selectOption('despesa');
  await digitarComFoco(modalLanc.getByLabel('Categoria'), 'Mercado');
  await digitarComFoco(modalLanc.getByLabel('Descrição'), 'Feira');
  await digitarComFoco(modalLanc.getByLabel('Valor (R$)'), '123.45');
  await digitarComFoco(modalLanc.getByLabel('Banco (opcional)'), 'Nubank');
  await shot('modal-lancamento');
  await modalLanc.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Lançamento criado!');
  await expect(modalLanc).toBeHidden();
  await expect(page.getByText('Feira').first()).toBeVisible();
  await shot('lancamento-criado');

  // ── 8. Chat ────────────────────────────────────────────────────────────────
  await bottomNav.getByRole('button', { name: 'Chat' }).click();
  const painel = page.getByRole('dialog', { name: 'Agente MeuDia' });
  await expect(painel).toBeVisible();
  await shot('chat-aberto');
  const entrada = painel.getByPlaceholder('Pergunte algo ao agente...');
  await digitarComFoco(entrada, 'Quanto gastei este mes?');
  await painel.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(painel.getByText('Quanto gastei este mes?')).toBeVisible();
  // Resposta do agente (processamento local em @meudia/ai, sem LLM): pelo menos 2 mensagens.
  await expect.poll(async () => {
    const st = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
    return (st.tables.chat_agente ?? []).filter((m: { role: string }) => m.role === 'agent').length;
  }).toBeGreaterThan(0);
  await expect(entrada).toBeEnabled();
  await shot('chat-resposta');
  await painel.getByRole('button', { name: 'Fechar painel' }).click();
  await expect(painel).toBeHidden();

  // ── 9. Drawer: abrir e visitar cada item ───────────────────────────────────
  const itensDrawer: { label: string; url: RegExp; titulo: RegExp }[] = [
    { label: 'Resumo do mês', url: /\/financas$/, titulo: /Finanças/ },
    { label: 'Contas', url: /\/financas\/contas$/, titulo: /Contas/ },
    { label: 'Orçamento', url: /\/financas\/orcamento$/, titulo: /Orçamento/ },
    { label: 'Assinaturas', url: /\/assinaturas$/, titulo: /Assinaturas/ },
    { label: 'Configurações', url: /\/configuracoes$/, titulo: /Configura/ },
  ];
  const abrirDrawer = async () => {
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    const drawer = page.getByRole('dialog', { name: '✦ MeuDia' });
    await expect(drawer).toBeVisible();
    return drawer;
  };
  let drawer = await abrirDrawer();
  await shot('drawer-aberto');
  for (const item of itensDrawer) {
    if (!(await drawer.isVisible())) drawer = await abrirDrawer();
    await drawer.getByRole('link', { name: item.label }).click();
    await page.waitForURL(item.url);
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(item.titulo);
    await shot(`drawer-${item.label.toLowerCase().replace(/\W+/g, '-').replace(/-+$/, '')}`);
  }

  // Links legais de Configurações abrem para quem está logado.
  await tocar(page.getByRole('link', { name: 'Politica de Privacidade' }));
  await page.waitForURL(/\/privacidade$/);
  await semVoltarParaOnboarding(page, 1_000);
  expect(new URL(page.url()).pathname).toBe('/privacidade');
  await shot('privacidade-logado');
  await page.goBack();
  await page.waitForURL(/\/configuracoes$/);

  // ── 10. Logout ─────────────────────────────────────────────────────────────
  drawer = await abrirDrawer();
  await drawer.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await shot('logout');
  // Antes de "digitar" outra URL, deixa terminar o prefetch de /registro da tela de login
  // (abortado pelo goto, o WebKit loga "Failed to fetch RSC payload ... Load failed").
  await page.waitForLoadState('networkidle');
  // Rota protegida sem sessão → /login.
  await page.goto('/financas');
  await page.waitForURL(/\/login/);

  // ── 11. Login de novo ──────────────────────────────────────────────────────
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await shot('login-preenchido');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/financas$/);
  await semVoltarParaOnboarding(page);
  await expect(page.getByText('Todas as contas do mês estão pagas.')).toBeVisible();
  await expect(page.getByText('Feira').first()).toBeVisible();
  await shot('login-novamente');

  // ── Relatório de erros ─────────────────────────────────────────────────────
  fs.writeFileSync(path.join(ARTIFACTS, 'problemas.json'), JSON.stringify(problemas, null, 2));
  const pageErrors = problemas.filter((p) => p.tipo === 'pageerror');
  const consoleErrors = problemas.filter((p) => p.tipo === 'console');
  const falhas = problemas.filter((p) => p.tipo === 'requestfailed' || p.tipo === 'http');
  if (problemas.length) console.log('Problemas coletados:\n' + JSON.stringify(problemas, null, 2));
  expect(pageErrors, 'erros não tratados na página').toEqual([]);
  expect(consoleErrors, 'console.error').toEqual([]);
  expect(falhas, 'requisições com falha').toEqual([]);
});
