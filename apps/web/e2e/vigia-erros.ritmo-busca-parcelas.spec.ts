import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { vigiarErros, type EventoVigia } from './vigia-erros';

/**
 * A ligação de `vigiarErros` (ritmo-busca-parcelas.spec.ts) com o WebKit de verdade, sem o app: páginas servidas por
 * `page.route` na origem do app, nada para um Supabase real. Determinístico e sem sleep (cada passo espera o evento de
 * que depende). A decisão sobre cada ordem possível de eventos está nos testes puros de `vigia-erros.test.ts` (Vitest).
 *
 * Medido no WebKit: o cancelamento que o app sofre (consultas do documento antigo viram "Fetch API cannot load <REST do
 * mock> due to access control checks" quando o teste navega) chega depois de o goto começar e antes do `pagehide` do
 * antigo; ele não se reproduz numa página sintética (consultas comuns em voo dão só `requestfailed` "cancelled" e
 * nenhum erro). Por isso aqui o documento antigo emite a MESMA mensagem lançando-a no próprio `pagehide`: um erro de
 * página real, do documento antigo, durante a desmontagem pelo goto, que é exatamente a janela que o filtro aceita.
 * O documento novo recebe um CORS de verdade do mock (`credentials: 'include'` contra "Allow-Origin: *").
 */
const APP = 'http://localhost:3105/__vigia';
const REST = 'http://127.0.0.1:54329/rest/v1/vigia';
const CORS = /^Fetch API cannot load http:\s?\/+127\.0\.0\.1:54329\/rest\/v1\/vigia/;

const html = (corpo: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${corpo}</body></html>`;
/** O documento lança, ao ser desmontado, a mensagem que o WebKit dá para a consulta REST cancelada. */
const cancelaAoSair = (url: string) =>
  `<script>addEventListener('pagehide', () => { throw 'Fetch API cannot load ${url} due to access control checks.'; })</script>A`;
/** Consulta recusada por CORS pelo mock, de verdade. */
const consultaSemCors = (url: string) => `<script>fetch('${url}', { credentials: 'include' }).catch(() => {})</script>`;

async function paginas(page: Page, mapa: Record<string, string>) {
  await page.route(`${APP}/**`, (route) => {
    const corpo = mapa[new URL(route.request().url()).pathname.split('/').pop()!];
    return corpo === undefined ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'text/html', body: html(corpo) });
  });
}

const tipos = (ev: EventoVigia[]) => ev.map((e) => e.tipo);
const mensagens = (ev: EventoVigia[]) => ev.flatMap((e) => (e.tipo === 'erro' ? [e.msg] : []));
const posErro = (ev: EventoVigia[]) => ev.findIndex((e) => e.tipo === 'erro' && CORS.test(e.msg));

test.describe('vigiarErros no WebKit', () => {
  test('erro REST do documento antigo desmontado pelo goto do teste (antes do documento novo) é ignorado', async ({ page }) => {
    const vigia = await vigiarErros(page);
    await paginas(page, { a: cancelaAoSair(`${REST}_cancelada?t=1`), b: 'B' });
    await page.goto(`${APP}/a`);
    await page.goto(`${APP}/b`);

    const ev = vigia.eventos();
    const erro = posErro(ev);
    // O erro aconteceu, dentro do goto, depois do "saida" do antigo e antes do "inicio" do novo.
    expect(erro, vigia.relatorio()).toBeGreaterThan(tipos(ev).lastIndexOf('doc-saida'));
    expect(erro, vigia.relatorio()).toBeLessThan(tipos(ev).lastIndexOf('doc-inicio'));
    expect(vigia.erros(), vigia.relatorio()).toEqual([]);
  });

  test('erro REST/CORS do documento NOVO durante o goto reprova', async ({ page }) => {
    const vigia = await vigiarErros(page);
    // A imagem segura o load de B até o erro chegar: o erro cai DENTRO do goto, já do documento novo.
    const erroChegou = new Promise<void>((r) => page.on('pageerror', (e) => CORS.test(`${e.name}: ${e.message}`) && r()));
    await page.route(`${APP}/img.png`, async (route) => {
      await erroChegou;
      await route.fulfill({ status: 204 });
    });
    await paginas(page, { a: 'A', b: `${consultaSemCors(`${REST}_novo?t=2`)}<img src="${APP}/img.png">` });
    await page.goto(`${APP}/a`);
    await page.goto(`${APP}/b`);

    const ev = vigia.eventos();
    const erro = posErro(ev);
    expect(erro, vigia.relatorio()).toBeGreaterThan(tipos(ev).lastIndexOf('doc-inicio'));
    expect(erro, 'o erro chegou durante o goto').toBeLessThan(tipos(ev).lastIndexOf('goto-fim'));
    expect(vigia.erros(), vigia.relatorio()).toEqual(mensagens(ev));
    expect(vigia.erros()).toContainEqual(expect.stringMatching(CORS));
  });

  test('falha de rede da mesma URL depois do goto reprova o erro que seria ignorado', async ({ page }) => {
    const vigia = await vigiarErros(page);
    const url = `${REST}_cancelada?t=3`;
    await paginas(page, { a: cancelaAoSair(url), b: 'B' });
    await page.goto(`${APP}/a`);
    await page.goto(`${APP}/b`);
    expect(posErro(vigia.eventos()), vigia.relatorio()).toBeGreaterThan(-1);
    expect(vigia.erros(), 'até aqui, ignorado (1º caso)').toEqual([]);

    // Depois de o goto terminar a gravação continua: a MESMA URL falha na rede e o erro de antes passa a reprovar.
    await page.route(url, (route) => route.abort('failed'));
    const falhou = page.waitForEvent('requestfailed', (r) => r.url() === url);
    await page.evaluate((u) => void fetch(u).catch(() => {}), url);
    await falhou;
    const ev = vigia.eventos();
    expect(ev.findIndex((e) => e.tipo === 'falha' && e.url === url), vigia.relatorio()).toBeGreaterThan(tipos(ev).lastIndexOf('goto-fim'));
    expect(vigia.erros(), vigia.relatorio()).toEqual([expect.stringMatching(CORS)]);
  });

  test('o mesmo erro numa navegação que não é do teste (location.assign) reprova', async ({ page }) => {
    const vigia = await vigiarErros(page);
    await paginas(page, { a: cancelaAoSair(`${REST}_cancelada?t=4`), b: 'B' });
    await page.goto(`${APP}/a`);
    await page.evaluate((u) => location.assign(u), `${APP}/b`);
    await page.waitForURL(`${APP}/b`);
    await expect.poll(() => posErro(vigia.eventos())).toBeGreaterThan(-1);

    expect(vigia.erros(), vigia.relatorio()).toEqual(mensagens(vigia.eventos()));
    expect(vigia.erros()).toContainEqual(expect.stringMatching(CORS));
  });
});
