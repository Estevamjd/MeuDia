import type { Page } from '@playwright/test';

/**
 * Vigia de erros de página dos E2E da Wave 3A, com exceções só para o que se prova vir do documento ANTIGO,
 * desmontado por um `page.goto` do PRÓPRIO teste.
 *
 * O WebKit reporta como "Fetch API cannot load <url> due to access control checks" as consultas que o documento antigo
 * tinha em voo quando o teste navega. Medido no WebKit do Playwright: esses erros chegam depois de o goto começar, ANTES
 * do `pagehide` do documento antigo e antes de o documento novo rodar qualquer script. Para separar isso de um erro
 * real, cada documento ganha um id (via `addInitScript`, que roda antes de qualquer script da página) e avisa o teste
 * quando começa ("inicio") e quando sai ("saida", no `pagehide`). Os avisos e os erros chegam pela mesma conexão do
 * inspector, na ordem em que aconteceram. Um documento novo não roda script nenhum antes do próprio "inicio", então um
 * erro entregue ANTES dele não pode ter vindo dele; e o "saida" do documento antigo no mesmo goto prova que ele foi
 * desmontado por essa navegação.
 *
 * Exceções (e nenhuma outra):
 * 1. REST do mock (127.0.0.1:54329/rest/v1/…): ignorado só se chegou com um goto do teste em andamento, ANTES do
 *    "inicio" de qualquer documento novo, se o documento aberto quando o goto começou deu "saida" nesse mesmo goto
 *    (antes do documento novo), e se essa URL nunca deu `requestfailed` no teste inteiro (falha de rede, antes ou
 *    depois do goto, reprova).
 * 2. Prefetch RSC do próprio app (localhost:3105/…?_rsc=…): mesma janela, e a URL nunca falhou na rede no teste (o
 *    mesmo padrão do REST, visto no WebKit: prefetch na fila, sem `request`) OU a MESMA URL deu `requestfailed`
 *    "cancelled" dentro do mesmo goto. Veto: qualquer `requestfailed` da mesma URL que NÃO seja cancelamento, em
 *    qualquer ponto do teste (antes, durante ou depois do goto), reprova, mesmo com o "cancelled" no mesmo goto.
 * Qualquer outro erro reprova: outra mensagem, erro fora de goto, navegação que não é do teste (`location.assign`
 * etc.), erro depois do "inicio" do documento novo, ou goto sem o "saida" do documento antigo. Não há folga de tempo:
 * só a ordem dos eventos decide. A decisão é tomada no fim (`erros()`), sobre o registro inteiro: nada para de ser
 * gravado quando o goto termina.
 */

export const ERRO_MOCK = /^Fetch API cannot load http:\s?\/+(127\.0\.0\.1:54329\/rest\/v1\/\S+) due to access control checks\.$/;
export const ERRO_RSC = /^Fetch API cannot load http:\s?\/+(localhost:3105\/\S*[?&]_rsc=\S+) due to access control checks\.$/;

export type EventoVigia =
  | { tipo: 'goto-inicio' }
  | { tipo: 'goto-fim' }
  | { tipo: 'doc-inicio'; doc: string }
  | { tipo: 'doc-saida'; doc: string }
  | { tipo: 'falha'; url: string; cancelada: boolean }
  | { tipo: 'erro'; msg: string };

type Contexto = { goto: number; docNovo: boolean };

/** Núcleo puro: devolve as mensagens de erro que reprovam, dado o registro em ordem de entrega. */
export function errosQueReprovam(eventos: readonly EventoVigia[]): string[] {
  const falhasNaRede = new Set<string>();
  /** URLs com `requestfailed` que NÃO é cancelamento, em qualquer ponto do teste: vetam a exceção do RSC. */
  const falhasReais = new Set<string>();
  const canceladasPorGoto = new Map<number, Set<string>>();
  /** gotos em que o documento antigo deu "saida" antes de qualquer documento novo começar. */
  const antigoSaiu = new Set<number>();
  const erros: { msg: string; ctx: Contexto | null }[] = [];
  let docAtual: string | null = null;
  let goto: (Contexto & { docAntigo: string | null }) | null = null;
  let gotos = 0;

  for (const e of eventos) {
    switch (e.tipo) {
      case 'goto-inicio':
        goto = { goto: ++gotos, docAntigo: docAtual, docNovo: false };
        canceladasPorGoto.set(gotos, new Set());
        break;
      case 'goto-fim':
        goto = null;
        break;
      case 'doc-inicio':
        docAtual = e.doc;
        if (goto) goto.docNovo = true;
        break;
      case 'doc-saida':
        if (goto && !goto.docNovo && goto.docAntigo !== null && e.doc === goto.docAntigo) antigoSaiu.add(goto.goto);
        break;
      case 'falha':
        falhasNaRede.add(e.url);
        if (!e.cancelada) falhasReais.add(e.url);
        if (goto && e.cancelada) canceladasPorGoto.get(goto.goto)!.add(e.url);
        break;
      case 'erro':
        erros.push({ msg: e.msg, ctx: goto ? { goto: goto.goto, docNovo: goto.docNovo } : null });
        break;
    }
  }

  const doAntigo = (ctx: Contexto | null): ctx is Contexto => !!ctx && !ctx.docNovo && antigoSaiu.has(ctx.goto);
  const ignorado = ({ msg, ctx }: (typeof erros)[number]) => {
    if (!doAntigo(ctx)) return false;
    const mock = ERRO_MOCK.exec(msg);
    if (mock) return !falhasNaRede.has(`http://${mock[1]}`);
    const rsc = ERRO_RSC.exec(msg);
    if (!rsc) return false;
    const url = `http://${rsc[1]}`;
    if (falhasReais.has(url)) return false;
    return !falhasNaRede.has(url) || canceladasPorGoto.get(ctx.goto)!.has(url);
  };
  return erros.filter((e) => !ignorado(e)).map((e) => e.msg);
}

const BINDING = '__vigiaErrosDoc';

/** Liga o vigia à página: precisa vir antes do primeiro goto. */
export async function vigiarErros(page: Page) {
  const eventos: EventoVigia[] = [];
  await page.exposeBinding(BINDING, (_fonte, fase: 'inicio' | 'saida', doc: string) => {
    eventos.push(fase === 'inicio' ? { tipo: 'doc-inicio', doc } : { tipo: 'doc-saida', doc });
  });
  await page.addInitScript((nome) => {
    if (window.top !== window) return;
    const w = window as unknown as Record<string, (fase: string, doc: string) => void>;
    const doc = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const avisar = (fase: string) => {
      try {
        void w[nome]?.(fase, doc);
      } catch {
        /* sem binding: sem aviso, e o erro reprova */
      }
    };
    avisar('inicio');
    window.addEventListener('pagehide', () => avisar('saida'), { capture: true });
  }, BINDING);

  const goto = page.goto.bind(page);
  page.goto = async (...args: Parameters<Page['goto']>) => {
    eventos.push({ tipo: 'goto-inicio' });
    try {
      return await goto(...args);
    } finally {
      eventos.push({ tipo: 'goto-fim' });
    }
  };
  page.on('requestfailed', (req) => {
    eventos.push({ tipo: 'falha', url: req.url(), cancelada: /cancel/i.test(req.failure()?.errorText ?? '') });
  });
  // O Playwright parte a mensagem no 1º ":", por isso o teste é sobre name + message.
  page.on('pageerror', (err) => eventos.push({ tipo: 'erro', msg: `${err.name}: ${err.message}` }));

  const relatorio = () => eventos.map((e) => JSON.stringify(e)).join('\n');
  return { erros: () => errosQueReprovam(eventos), eventos: () => eventos.slice(), relatorio };
}
