// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SobraDoMes } from '@meudia/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { CORES_APP, PALETA_CORES } from '../../../../lib/cores-app';
import { CardResumoDeslizante, paginasDoCartao, type MetaDoCartao } from '../CardResumoDeslizante';

afterEach(cleanup);

const t = (el: HTMLElement) => (el.textContent ?? '').replace(/\s/g, ' ');

// Cenário da Lia (mockup v4): renda 943, contas fixas 744 (620 pagas), extras 59,90 → deve sobrar 139,10.
const sobra: SobraDoMes = {
  competencia: '2026-11', renda: { lancada: 943, aReceber: 0, total: 943 }, rendasAReceber: [], previsao: false,
  contasFixas: [
    { id: 'c', descricao: 'Curso', categoria: 'Educação', valor: 620, vencimento: '2026-11-05', paga: true, pagoEm: '2026-11-05' },
    { id: 'k', descricao: 'Celular', categoria: 'Outros', valor: 124, vencimento: '2026-11-25', paga: false, pagoEm: null },
  ],
  totalContasFixas: 744, totalContasPagas: 620, gastosExtras: 59.9, despesasLancadas: 679.9, contasAPagar: [], despesas: 803.9, valor: 139.1,
};
const meta: MetaDoCartao = {
  id: 'm1', nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00Z',
};
const base = { sobra, cofrinho: 150, hojeISO: '2026-11-19' };

describe('CardResumoDeslizante (Início v5, maço)', () => {
  it('páginas: Resumo e Ritmo; Meta só quando existe meta', () => {
    expect(paginasDoCartao(false).map((p) => p.titulo)).toEqual(['Resumo', 'Ritmo']);
    expect(paginasDoCartao(true).map((p) => p.titulo)).toEqual(['Resumo', 'Ritmo', 'Meta']);
  });

  it('sem meta: 2 páginas, sem linha nem página de meta', () => {
    render(<CardResumoDeslizante {...base} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('2');
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['1 de 2: Resumo', '2 de 2: Ritmo']);
    expect(screen.queryByTestId('cartao-meta-mini')).toBeNull();
    expect(screen.queryByTestId('cartao-pagina-meta')).toBeNull();
  });

  it('cartão 1: deve sobrar, % com destino, Cofrinho (link para Bancos); cartão 2 mantém a conta (Você recebe − Contas fixas − Gastos)', () => {
    render(<CardResumoDeslizante {...base} />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ 139,10');
    expect(t(screen.getByTestId('cartao-pagina-resumo'))).toContain('85% da renda já tem destino');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ 150,00');
    expect((screen.getByTestId('linha-cofrinho')).getAttribute('href')).toBe('/financas/carteiras');
    const conta = screen.getByTestId('cartao-pagina-conta');
    expect(t(within(conta).getByTestId('resumo-renda'))).toBe('R$ 943,00');
    expect(t(within(conta).getByTestId('previsao-fim-mes-valor'))).toBe('R$ 139,10');
    expect(t(within(conta).getByTestId('resumo-contas-fixas'))).toBe('− R$ 744,00');
    expect(t(within(conta).getByTestId('resumo-gastos'))).toBe('− R$ 59,90');
    expect(within(conta).getByRole('heading', { level: 2 }).textContent).toBe('Ritmo de novembro');
  });

  it('ⓘ do Cofrinho: com a 014 explica o dinheiro guardado; sem a 014 (cofrinhoLegado) explica a soma dos bancos', () => {
    const abrir = () => {
      fireEvent.click(within(screen.getByTestId('cartao-pagina-resumo')).getByRole('button', { name: 'O que é Cofrinho?' }));
      return t(screen.getByRole('dialog', { name: 'Cofrinho' }));
    };
    render(<CardResumoDeslizante {...base} />);
    expect(abrir()).toContain('Dinheiro que você já guardou.');
    cleanup();
    render(<CardResumoDeslizante {...base} cofrinhoLegado />);
    const legado = abrir();
    expect(legado).toContain('saldo de hoje dos seus bancos que entram no total');
    expect(legado).not.toContain('já guardou');
  });

  it('com meta: 3 páginas, linha da meta na página 1 e a página Meta com %, valores, falta, hoje, ritmo e por mês', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('3');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('Celular novo');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('42%');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ 840,00 guardados de R$ 2.000,00');
    expect(t(screen.getByTestId('cartao-meta-falta'))).toBe('FaltamR$ 1.160');
    expect(t(screen.getByTestId('cartao-meta-hoje'))).toBe('hoje 37%');
    expect(t(screen.getByTestId('cartao-meta-ritmo'))).toBe('à frente do ritmo');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('R$ 290');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('acima da sobra');
    expect(t(screen.getByTestId('cartao-pagina-meta'))).toContain('mar/27');
    expect((screen.getByRole('progressbar', { name: 'Meta Celular novo' })).getAttribute('aria-valuetext')).toBe('42% guardado; pelo ritmo, hoje seria 37%');
  });

  it('olho fechado esconde valores em todas as páginas (o % continua)', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} escondido />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ ••••• guardados de R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(document.body.textContent).not.toMatch(/139,10|943,00|744,00|1\.160/);
  });

  it('botões ‹ › substituem o arrastar (WCAG 2.5.1): passam o cartão e anunciam; no último (Meta) vira "Guardar"', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const anterior = screen.getByRole('button', { name: 'Cartão anterior' });
    expect((anterior as HTMLButtonElement).disabled).toBe(true);
    const proximo = screen.getByRole('button', { name: 'Próximo cartão: Ritmo' });
    expect(proximo.hasAttribute('aria-controls')).toBe(true);
    fireEvent.click(proximo);
    expect(screen.getByText('Cartão 2 de 3: Ritmo')).toBeTruthy();
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · Ritmo');
    expect(screen.getByRole('button', { name: 'Cartão anterior: Resumo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Meta' }));
    expect(screen.getByText('Cartão 3 de 3: Meta')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Guardar/ }).getAttribute('href')).toBe('/financas/metas');
  });

  it('só o cartão da frente recebe foco e toque (os de trás ficam inert) e ele é marcado como frente', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const inert = (id: string) => (screen.getByTestId(id) as HTMLElement & { inert: boolean }).inert;
    expect([inert('cartao-pagina-resumo'), inert('cartao-pagina-conta'), inert('cartao-pagina-meta')]).toEqual([false, true, true]);
    expect(screen.getByTestId('cartao-pagina-resumo').className).toContain('cartao-frente');
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect([inert('cartao-pagina-resumo'), inert('cartao-pagina-conta'), inert('cartao-pagina-meta')]).toEqual([true, false, true]);
  });

  it('cada cartão mora numa página do trilho (passo do snap); o lado (esq/atual/dir) vem do React, sem pose inline', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
    const lado = (id: string) => screen.getByTestId(id).getAttribute('data-lado');
    for (const [i, id] of ['cartao-pagina-resumo', 'cartao-pagina-conta', 'cartao-pagina-meta'].entries()) {
      const slide = screen.getByTestId(id).parentElement!;
      expect(slide.className).toBe('maco-slide');
      expect(slide.getAttribute('data-slide')).toBe(String(i));
      expect(slide.parentElement).toBe(trilho);
      expect((screen.getByTestId(id) as HTMLElement).getAttribute('style')).toBeNull();
    }
    expect([lado('cartao-pagina-resumo'), lado('cartao-pagina-conta'), lado('cartao-pagina-meta')]).toEqual(['atual', 'dir', 'dir']);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect([lado('cartao-pagina-resumo'), lado('cartao-pagina-conta'), lado('cartao-pagina-meta')]).toEqual(['esq', 'atual', 'dir']);
  });

  it('"Contas fixas" no cartão abre a lista abaixo do maço, com pago / a pagar', () => {
    render(<CardResumoDeslizante {...base} />);
    const botao = screen.getByRole('button', { name: /^Contas fixas/ });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    const lista = screen.getByRole('list', { name: 'Contas fixas de novembro' });
    expect(botao.getAttribute('aria-controls')).toBe(lista.id);
    expect(t(lista)).toContain('Curso');
    expect(t(lista)).toContain('pago');
    expect(t(screen.getByTestId('resumo-contas-fixas-status'))).toContain('1 paga · 1 a pagar');
  });

  it('setas do teclado passam os cartões', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
    fireEvent.keyDown(trilho, { key: 'ArrowRight' });
    expect(screen.getByText('Cartão 2 de 3: Ritmo')).toBeTruthy();
    fireEvent.keyDown(trilho, { key: 'ArrowLeft' });
    expect(screen.getByText('Cartão 1 de 3: Resumo')).toBeTruthy();
  });

  it('rolagem: arrastar não re-renderiza por quadro: a página só muda quando o trilho assenta; segurar é só uma classe', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    vi.useFakeTimers();
    try {
      render(<CardResumoDeslizante {...base} metas={[meta]} />);
      expect(screen.getByTestId('cartao-maco').getAttribute('data-maco')).toBe('rolagem');
      const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
      const secao = screen.getByTestId('cartao-resumo');
      Object.defineProperty(trilho, 'clientWidth', { configurable: true, value: 390 });
      fireEvent.touchStart(trilho);
      expect(secao.className).toContain('maco-segurando');
      let rolagem = 300;
      Object.defineProperty(trilho, 'scrollLeft', { configurable: true, get: () => rolagem });
      fireEvent.scroll(trilho);
      // No meio do gesto continua no cartão 1 (nada de setState por evento de rolagem).
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('1 de 3 · Resumo');
      rolagem = 390;
      fireEvent.scroll(trilho);
      fireEvent.touchEnd(trilho);
      expect(secao.className).not.toContain('maco-segurando');
      act(() => { vi.advanceTimersByTime(700); });
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · Ritmo');
      expect(screen.getByText('Cartão 2 de 3: Ritmo')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('rolagem sem scrollend: dedo parado no meio do gesto não troca de cartão; ao soltar, assenta', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    // Tira `onscrollend` de toda a cadeia de protótipos do window (o jsdom tem).
    const removidos: [object, PropertyDescriptor][] = [];
    for (let o: object | null = window; o; o = Object.getPrototypeOf(o)) {
      const d = Object.getOwnPropertyDescriptor(o, 'onscrollend');
      if (d) { removidos.push([o, d]); Reflect.deleteProperty(o, 'onscrollend'); }
    }
    vi.useFakeTimers();
    try {
      expect('onscrollend' in window).toBe(false);
      render(<CardResumoDeslizante {...base} metas={[meta]} />);
      const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
      Object.defineProperty(trilho, 'clientWidth', { configurable: true, value: 390 });
      Object.defineProperty(trilho, 'scrollLeft', { configurable: true, value: 300 });
      fireEvent.touchStart(trilho);
      fireEvent.scroll(trilho);
      act(() => { vi.advanceTimersByTime(500); });
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('1 de 3 · Resumo');
      fireEvent.touchEnd(trilho);
      act(() => { vi.advanceTimersByTime(200); });
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · Ritmo');
      expect(screen.getByText('Cartão 2 de 3: Ritmo')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      for (const [o, d] of removidos) Object.defineProperty(o, 'onscrollend', d);
    }
  });
});

/** matchMedia com "reduzir movimento" ligado ou não (o jsdom não tem). */
const comMovimento = (reduzir: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduzir && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

/** IntersectionObserver de mentira: guarda o callback, as opções e o que foi observado. */
function stubObservador() {
  const obs: { cb?: IntersectionObserverCallback; opcoes?: IntersectionObserverInit; alvos: Element[]; desligado: boolean } = { alvos: [], desligado: false };
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback, opcoes: IntersectionObserverInit) { obs.cb = cb; obs.opcoes = opcoes; }
    observe(el: Element) { obs.alvos.push(el); }
    disconnect() { obs.desligado = true; }
  });
  const cruzar = (itens: [indice: number, fracao: number][]) =>
    act(() => {
      obs.cb!(itens.map(([i, fracao]) => ({ target: obs.alvos[i]!, isIntersecting: fracao > 0, intersectionRatio: fracao }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver);
    });
  return { obs, cruzar };
}

describe('caminho do maço (data-maco): rolagem × reserva', () => {
  afterEach(() => vi.unstubAllGlobals());
  const palco = () => screen.getByTestId('cartao-maco');

  it('SSR/primeira pintura sem data-maco (quem decide é o @supports); o JS marca o palco depois', () => {
    const html = renderToString(<CardResumoDeslizante {...base} metas={[meta]} />);
    const tagPalco = html.match(/<div[^>]*data-testid="cartao-maco"[^>]*>/)![0];
    expect(tagPalco).toContain('class="maco-palco');
    expect(tagPalco).not.toContain('data-maco');
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    expect(palco().getAttribute('data-maco')).toBe('reserva');
  });

  it('com scroll-driven animations (CSS.supports) e sem "reduzir movimento": rolagem', () => {
    vi.stubGlobal('CSS', { supports: (q: string) => /animation-timeline: --maco|timeline-scope: --maco/.test(q) });
    comMovimento(false);
    render(<CardResumoDeslizante {...base} />);
    expect(palco().getAttribute('data-maco')).toBe('rolagem');
  });

  it('CSS.supports dizendo não a "timeline" (iOS < 26, ou o benchmark forçando): reserva', () => {
    vi.stubGlobal('CSS', { supports: (q: string) => !q.includes('timeline') });
    comMovimento(false);
    render(<CardResumoDeslizante {...base} />);
    expect(palco().getAttribute('data-maco')).toBe('reserva');
  });

  it('"reduzir movimento" usa a reserva mesmo com suporte', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    comMovimento(true);
    render(<CardResumoDeslizante {...base} />);
    expect(palco().getAttribute('data-maco')).toBe('reserva');
  });

  it('reserva: o IntersectionObserver (raiz no trilho, 60%) troca o cartão ativo e anuncia, só na troca', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { obs, cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
    // (toBe, não toMatchObject: comparar um nó do DOM por estrutura percorre o documento inteiro)
    expect(obs.opcoes!.root).toBe(trilho);
    expect(obs.opcoes!.threshold).toEqual([0.6]);
    expect(obs.alvos.map((el) => el.getAttribute('data-slide'))).toEqual(['0', '1', '2']);
    // No meio do gesto (nenhum cartão passou de 60%), nada muda.
    cruzar([[0, 0.55], [1, 0.45]]);
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('1 de 3 · Resumo');
    cruzar([[1, 0.72], [0, 0.28]]);
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · Ritmo');
    expect(screen.getByText('Cartão 2 de 3: Ritmo')).toBeTruthy();
    expect(screen.getByTestId('cartao-pagina-conta').className).toContain('cartao-frente');
    expect(screen.getByTestId('cartao-pagina-resumo').getAttribute('data-lado')).toBe('esq');
  });

  it('reserva: botão "Próximo" vai direto ao destino; cartões cruzados no caminho da rolagem suave não contam', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    cruzar([[0, 0.9]]); // ainda saindo do 1º
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · Ritmo');
    // Como o IntersectionObserver de verdade: quem cruza o limiar (para cima ou para baixo) vem na entrega.
    cruzar([[1, 1], [0, 0]]); // chegou
    cruzar([[2, 0.8], [1, 0.2]]); // depois de chegar, o dedo volta a mandar
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('3 de 3 · Meta');
  });

  it('reserva: nenhum listener de rolagem, nenhum rAF e nenhuma pose escrita no arrasto', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    stubObservador();
    const raf = vi.fn(() => 0);
    vi.stubGlobal('requestAnimationFrame', raf);
    const ouvir = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    try {
      render(<CardResumoDeslizante {...base} metas={[meta]} />);
      const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
      const noTrilho = ouvir.mock.calls.filter((_, i) => ouvir.mock.contexts[i] === trilho).map(([tipo]) => tipo);
      expect(noTrilho).not.toContain('scroll');
      expect(noTrilho).not.toContain('touchstart');
      // Só o que larga o destino dos botões (passivos, nada por quadro).
      expect([...noTrilho].sort()).toEqual(['keydown', 'pointerdown', 'wheel']);
      for (const [tipo, , opcoes] of ouvir.mock.calls.filter((_, i) => ouvir.mock.contexts[i] === trilho)) {
        if (tipo !== 'keydown') expect(opcoes).toEqual({ passive: true });
      }
      Object.defineProperty(trilho, 'scrollLeft', { configurable: true, value: 300 });
      fireEvent.touchStart(trilho);
      for (let i = 0; i < 10; i++) fireEvent.scroll(trilho);
      fireEvent.touchEnd(trilho);
      expect(raf).not.toHaveBeenCalled();
      expect(screen.getByTestId('cartao-resumo').className).not.toContain('maco-segurando');
      for (const id of ['cartao-pagina-resumo', 'cartao-pagina-conta', 'cartao-pagina-meta']) {
        expect((screen.getByTestId(id) as HTMLElement).getAttribute('style')).toBeNull();
      }
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('1 de 3 · Resumo');
    } finally {
      ouvir.mockRestore();
    }
  });

  it('rolagem: sem IntersectionObserver (quem assenta é o trilho) e o CSS do maço só vale no palco em rolagem', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    comMovimento(false);
    const { obs } = stubObservador();
    const { container } = render(<CardResumoDeslizante {...base} metas={[meta]} />);
    expect(obs.cb).toBeUndefined();
    const css = container.querySelector('style')!.innerHTML;
    expect(css).toContain('.maco-palco:is([data-maco="rolagem"],:not([data-maco]))[data-total="3"] .maco-cartao[data-i="0"]{');
    expect(css).not.toMatch(/(^|\})\.maco-palco\[data-total/);
  });
});

/** matchMedia cuja preferência "reduzir movimento" muda com a página aberta (dispara os listeners de change). */
function movimentoMutavel(reduzirInicial: boolean) {
  let reduzir = reduzirInicial;
  const ouvintes = new Set<() => void>();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return reduzir && q.includes('reduce'); },
    media: q,
    addEventListener: (_: string, fn: () => void) => ouvintes.add(fn),
    removeEventListener: (_: string, fn: () => void) => ouvintes.delete(fn),
  }));
  const mudar = (v: boolean) => act(() => { reduzir = v; for (const fn of [...ouvintes]) fn(); });
  return { mudar, ouvintes };
}

/** Trilho de 390px com scrollTo espionado (no jsdom offsetWidth = 0, então o passo é a largura do trilho). */
function trilhoMedido() {
  const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
  Object.defineProperty(trilho, 'clientWidth', { configurable: true, value: 390 });
  const scrollTo = vi.fn();
  (trilho as HTMLElement & { scrollTo: unknown }).scrollTo = scrollTo;
  return { trilho, scrollTo };
}

const posicao = () => t(screen.getByTestId('cartao-posicao'));
const anuncio = () => screen.getByTestId('cartao-resumo').querySelector('[aria-live="polite"]')!.textContent;
const inertes = () =>
  ['cartao-pagina-resumo', 'cartao-pagina-conta', 'cartao-pagina-meta'].map((id) => (screen.getByTestId(id) as HTMLElement & { inert: boolean }).inert);

describe('reserva: destino dos botões interrompido, scrollTo, "reduzir movimento" em runtime e limpeza', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['dedo/mouse (pointerdown)', (el: HTMLElement) => fireEvent.pointerDown(el)],
    ['roda (wheel)', (el: HTMLElement) => fireEvent.wheel(el)],
    ['tecla que rola (Home)', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'Home' })],
  ])('voltar ao cartão anterior no meio da rolagem suave, por %s, larga o destino e reconcilia o ativo', (_, interromper) => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { trilho } = trilhoMedido();
    cruzar([[0, 1], [1, 0], [2, 0]]); // estado inicial que o observador entrega
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect(posicao()).toBe('2 de 3 · Ritmo');
    cruzar([[1, 0.65], [0, 0.35]]); // a rolagem suave começa e a pessoa a interrompe…
    interromper(trilho);
    cruzar([[0, 0.9], [1, 0.1]]); // …e volta ao 1º antes de o destino chegar
    expect(posicao()).toBe('1 de 3 · Resumo');
    expect(anuncio()).toBe('Cartão 1 de 3: Resumo');
    expect(inertes()).toEqual([false, true, true]);
  });

  it('a pessoa assume sem nenhum cartão novo cruzar: reconcilia na hora pela última interseção registrada', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { trilho } = trilhoMedido();
    cruzar([[0, 1], [1, 0], [2, 0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    cruzar([[0, 0.9]]); // ainda no 1º (filtrado pelo destino)
    expect(posicao()).toBe('2 de 3 · Ritmo');
    fireEvent.pointerDown(trilho);
    expect(posicao()).toBe('1 de 3 · Resumo');
    expect(inertes()).toEqual([false, true, true]);
    // Depois de largar, o observador volta a mandar.
    cruzar([[1, 0.7], [0, 0.3]]);
    expect(posicao()).toBe('2 de 3 · Ritmo');
  });

  it('destino expira (900 ms) sem chegar: posição, anúncio e inert voltam ao cartão que está à vista', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.useFakeTimers();
    const { cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    trilhoMedido();
    cruzar([[0, 1], [1, 0], [2, 0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    cruzar([[0, 0.9]]);
    act(() => { vi.advanceTimersByTime(899); });
    expect(posicao()).toBe('2 de 3 · Ritmo');
    expect(inertes()).toEqual([true, false, true]);
    act(() => { vi.advanceTimersByTime(1); });
    expect(posicao()).toBe('1 de 3 · Resumo');
    expect(anuncio()).toBe('Cartão 1 de 3: Resumo');
    expect(inertes()).toEqual([false, true, true]);
  });

  it('destino expira sem interseção acima do limiar: reconcilia pelo scrollLeft (uma leitura)', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.useFakeTimers();
    stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { trilho } = trilhoMedido();
    const leitura = vi.fn(() => 780);
    Object.defineProperty(trilho, 'scrollLeft', { configurable: true, get: leitura });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    act(() => { vi.advanceTimersByTime(900); });
    expect(posicao()).toBe('3 de 3 · Meta');
    expect(anuncio()).toBe('Cartão 3 de 3: Meta');
    expect(inertes()).toEqual([true, true, false]);
    expect(leitura).toHaveBeenCalledTimes(1);
  });

  it('chegar ao destino cancela o timer; seta ← → no meio troca o destino em vez de largar', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.useFakeTimers();
    const { cruzar } = stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { trilho } = trilhoMedido();
    cruzar([[0, 1], [1, 0], [2, 0]]);
    const antes = vi.getTimerCount();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect(vi.getTimerCount()).toBe(antes + 1);
    cruzar([[1, 1], [0, 0]]);
    expect(vi.getTimerCount()).toBe(antes);
    fireEvent.keyDown(trilho, { key: 'ArrowRight' });
    cruzar([[1, 0.3], [2, 0.7]]);
    expect(posicao()).toBe('3 de 3 · Meta');
  });

  it.each([
    [false, 'smooth'],
    [true, 'auto'],
  ] as const)('botões ‹ › chamam scrollTo com a posição do cartão (reduzir movimento=%s → %s)', (reduzir, comportamento) => {
    vi.stubGlobal('CSS', { supports: () => false });
    comMovimento(reduzir);
    stubObservador();
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { scrollTo } = trilhoMedido();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 390, behavior: comportamento });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Meta' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 780, behavior: comportamento });
    fireEvent.click(screen.getByRole('button', { name: 'Cartão anterior: Ritmo' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 390, behavior: comportamento });
  });

  it('"reduzir movimento" muda com a página aberta, nos dois sentidos, no 2º e no 3º cartão: troca o caminho e realinha', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const { mudar, ouvintes } = movimentoMutavel(false);
    const { obs } = stubObservador();
    const { unmount } = render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const palco = screen.getByTestId('cartao-maco');
    const { scrollTo } = trilhoMedido();
    expect(palco.getAttribute('data-maco')).toBe('rolagem');
    expect(obs.cb).toBeUndefined();

    // 2º cartão: rolagem → reserva.
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 390, behavior: 'smooth' });
    mudar(true);
    expect(palco.getAttribute('data-maco')).toBe('reserva');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 390, behavior: 'auto' });
    expect(obs.cb).toBeDefined();
    expect(posicao()).toBe('2 de 3 · Ritmo');
    expect(inertes()).toEqual([true, false, true]);

    // 3º cartão (já com reduzir: sem suavidade): reserva → rolagem.
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Meta' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 780, behavior: 'auto' });
    mudar(false);
    expect(palco.getAttribute('data-maco')).toBe('rolagem');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 780, behavior: 'auto' });
    expect(obs.desligado).toBe(true);
    expect(posicao()).toBe('3 de 3 · Meta');
    expect(inertes()).toEqual([true, true, false]);

    // E volta à reserva no 3º.
    obs.desligado = false;
    mudar(true);
    expect(palco.getAttribute('data-maco')).toBe('reserva');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 780, behavior: 'auto' });
    expect(posicao()).toBe('3 de 3 · Meta');

    unmount();
    expect(ouvintes.size).toBe(0);
    expect(obs.desligado).toBe(true);
  });

  it('desmontar desliga o observador, tira os listeners do trilho e cancela o timer do destino', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.useFakeTimers();
    const { obs } = stubObservador();
    const { unmount } = render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const { trilho } = trilhoMedido();
    const tirar = vi.spyOn(trilho, 'removeEventListener');
    const antes = vi.getTimerCount();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Ritmo' }));
    expect(vi.getTimerCount()).toBe(antes + 1);
    unmount();
    expect(obs.desligado).toBe(true);
    expect(tirar.mock.calls.map(([tipo]) => tipo).sort()).toEqual(['keydown', 'pointerdown', 'wheel']);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(antes);
  });
});

describe('material do maço e pílula de situação (globals.css)', () => {
  const css = readFileSync(resolve(__dirname, '../../../../app/globals.css'), 'utf8');
  const ROLAGEM = ".maco-palco:is([data-maco='rolagem'], :not([data-maco]))";

  it('rolagem: o .cartao-cc tem camada própria permanente (o "segurar" só move, não repinta); regras escopadas por data-maco', () => {
    expect(css).toContain(`${ROLAGEM} .lap-heroi.cartao-cc { will-change: transform; }`);
    expect(css).toContain('.maco-segurando .cartao-frente > .cartao-cc { translate: 0 -3px; }');
    expect(css).toContain(`${ROLAGEM} .maco-trilho { position: static;`);
    expect(css).toMatch(/@supports \(animation-timeline: --maco\) and \(timeline-scope: --maco\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{\s*\.maco-palco:is/);
  });

  it('reserva (base): scroll-snap nativo e transição só de transform/opacity (nada de sombra ou z-index animados)', () => {
    const trilho = css.match(/\n\.maco-trilho \{([^}]*)\}/)![1]!;
    expect(trilho).toContain('scroll-snap-type: x mandatory');
    expect(css).toMatch(/\.maco-slide \{[^}]*scroll-snap-align: center/);
    const cartao = css.match(/\n\.maco-cartao \{([^}]*)\}/)![1]!;
    const transicao = cartao.match(/transition:([^;]*);/)![1]!;
    expect(transicao).toMatch(/transform/);
    expect(transicao).toMatch(/opacity/);
    expect(transicao).not.toMatch(/box-shadow|z-index|all/);
    expect(cartao).not.toMatch(/z-index/);
    // Grão (feTurbulence + mix-blend-mode) fora na reserva; volta na rolagem.
    expect(css).toContain('.maco-cartao > .lap-heroi.cartao-cc::after { display: none; }');
    expect(css).toContain(`${ROLAGEM} .maco-cartao > .lap-heroi.cartao-cc::after { display: block; }`);
  });

  it('pílula de situação: contraste ≥ 7:1 (AAA) nas três situações', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contraste = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x! + 0.05) / (y! + 0.05);
    };
    // "No controle" segue a cor do app (variáveis geradas de PALETA_CORES); atenção e passou são fixas.
    expect(css).toContain('.lap-heroi .pilula-situacao { background: var(--lap-pilula-fundo); border-color: var(--lap-pilula-borda); color: var(--lap-pilula-texto); }');
    for (const cor of CORES_APP) {
      const { fundo, texto } = PALETA_CORES[cor].heroi.pilula;
      expect(contraste(fundo, texto), cor).toBeGreaterThanOrEqual(7);
    }
    const regras = [...css.matchAll(/\.lap-heroi \.pilula-situacao\[data-situacao='(\w+)'\] \{ background: (#[0-9a-f]{6}); border-color: #[0-9a-f]{6}; color: (#[0-9a-f]{6}); \}/g)];
    expect(regras.map((r) => r[1])).toEqual(['atencao', 'passou']);
    for (const [, , fundo, texto] of regras) expect(contraste(fundo!, texto!)).toBeGreaterThanOrEqual(7);
  });

  it('a pílula do cartão leva pilula-situacao + data-situacao', () => {
    render(<CardResumoDeslizante {...base} />);
    const pilula = screen.getByTestId('pilula-situacao');
    expect(pilula.className).toContain('pilula-situacao');
    expect(pilula.getAttribute('data-situacao')).toBe('no-controle');
  });
});
