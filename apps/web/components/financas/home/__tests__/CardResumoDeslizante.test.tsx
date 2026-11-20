// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SobraDoMes } from '@meudia/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CardResumoDeslizante, paginasDoCartao, type MetaDoCartao } from '../CardResumoDeslizante';
import { poseDoCartao, transformDaPose } from '../poseDoMaco';

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
  it('páginas: Resumo e A conta; Meta só quando existe meta', () => {
    expect(paginasDoCartao(false).map((p) => p.titulo)).toEqual(['Resumo', 'A conta']);
    expect(paginasDoCartao(true).map((p) => p.titulo)).toEqual(['Resumo', 'A conta', 'Meta']);
  });

  it('sem meta: 2 páginas, sem linha nem página de meta', () => {
    render(<CardResumoDeslizante {...base} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('2');
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['1 de 2: Resumo', '2 de 2: A conta']);
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
    expect(within(conta).getByRole('heading', { level: 2 }).textContent).toBe('A conta de novembro');
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
    const proximo = screen.getByRole('button', { name: 'Próximo cartão: A conta' });
    expect(proximo.hasAttribute('aria-controls')).toBe(true);
    fireEvent.click(proximo);
    expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · A conta');
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
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: A conta' }));
    expect([inert('cartao-pagina-resumo'), inert('cartao-pagina-conta'), inert('cartao-pagina-meta')]).toEqual([true, false, true]);
  });

  it('pose inicial do maço: o 1º na frente, os outros atrás à direita, menores e girados', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const tr = (id: string) => (screen.getByTestId(id) as HTMLElement).style.transform;
    expect(tr('cartao-pagina-resumo')).toBe('translateX(calc(0.00% + 0.00px)) rotate(0.00deg) scale(1.0000)');
    expect(tr('cartao-pagina-conta')).toBe('translateX(calc(0.00% + 13.00px)) rotate(2.40deg) scale(0.9450)');
    expect(tr('cartao-pagina-meta')).toBe('translateX(calc(0.00% + 26.00px)) rotate(4.80deg) scale(0.8900)');
  });

  it('"Contas fixas" no cartão abre a lista abaixo do maço, com pago / a pagar', () => {
    render(<CardResumoDeslizante {...base} />);
    const botao = screen.getByRole('button', { name: /Contas fixas/ });
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
    expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    fireEvent.keyDown(trilho, { key: 'ArrowLeft' });
    expect(screen.getByText('Cartão 1 de 3: Resumo')).toBeTruthy();
  });

  it('arrastar não re-renderiza por quadro: a página só muda quando o trilho assenta; segurar é só uma classe', () => {
    vi.useFakeTimers();
    try {
      render(<CardResumoDeslizante {...base} metas={[meta]} />);
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
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · A conta');
      expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('caminho em JS (iOS < 26): o quadro só lê scrollLeft (largura vem do ResizeObserver), escreve a pose e z-index só na virada', () => {
    let aoRedimensionar: ((e: { contentRect: { width: number } }[]) => void) | undefined;
    vi.stubGlobal('ResizeObserver', class { constructor(cb: typeof aoRedimensionar) { aoRedimensionar = cb; } observe() {} disconnect() {} });
    vi.useFakeTimers();
    try {
      render(<CardResumoDeslizante {...base} metas={[meta]} />);
      const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
      act(() => aoRedimensionar!([{ contentRect: { width: 390 } }]));
      let leiturasLargura = 0;
      Object.defineProperty(trilho, 'clientWidth', { configurable: true, get: () => { leiturasLargura++; return 390; } });
      let rolagem = 0;
      Object.defineProperty(trilho, 'scrollLeft', { configurable: true, get: () => rolagem });
      // Conta as escritas no cartão 1 (o que sai em arco).
      const cartao = screen.getByTestId('cartao-pagina-resumo');
      const proto = Object.getPrototypeOf(cartao.style) as object;
      const escritas: Record<'transform' | 'zIndex', string[]> = { transform: [], zIndex: [] };
      for (const prop of ['transform', 'zIndex'] as const) {
        const d = Object.getOwnPropertyDescriptor(proto, prop)!;
        Object.defineProperty(cartao.style, prop, { configurable: true, get() { return d.get!.call(this); }, set(v: string) { escritas[prop].push(v); d.set!.call(this, v); } });
      }
      const rolarPara = (px: number) => { rolagem = px; fireEvent.scroll(trilho); act(() => { vi.advanceTimersByTime(16); }); };

      rolarPara(39); // p = 0,1: cartão 1 vai por cima (z 30)
      expect(cartao.style.transform).toBe(transformDaPose(poseDoCartao(-0.1, 390)));
      rolarPara(78);
      rolarPara(117);
      rolarPara(117); // mesma posição: nada a escrever
      rolarPara(234); // p = 0,6: passou da metade, vai para trás (z 18)
      expect(cartao.style.transform).toBe(transformDaPose(poseDoCartao(-0.6, 390)));
      expect(escritas.transform).toHaveLength(4);
      expect(escritas.zIndex).toEqual(['30', '18']);
      expect(leiturasLargura).toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('sem scrollend (iOS < 26): dedo parado no meio do gesto não troca de cartão; ao soltar, assenta', () => {
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
      expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · A conta');
      expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      for (const [o, d] of removidos) Object.defineProperty(o, 'onscrollend', d);
    }
  });
});

describe('material do maço em camada fixa (globals.css)', () => {
  const css = readFileSync(resolve(__dirname, '../../../../app/globals.css'), 'utf8');
  it('o .cartao-cc tem camada própria permanente: o "segurar" (translate com transição) não promove nem repinta o cartão', () => {
    expect(css).toMatch(/\.lap-heroi\.cartao-cc\s*\{\s*will-change:\s*transform;\s*\}/);
    expect(css).toContain('.maco-segurando .cartao-frente > .cartao-cc { translate: 0 -3px; }');
  });
});
