import { describe, expect, it } from 'vitest';
import { ROTAS_LEGADAS, isRotaLegada, isRotaVisivel } from '../app-mode';
import {
  HREF_NOVA_CONTA,
  isNavAtivo,
  itensBottomFinancas,
  itensDrawer,
  secoesDrawer,
  secoesSidebar,
} from '../navegacao';

// Módulos legados removidos (20/11/2026): nenhuma navegação aponta para eles, em nenhum modo.
const OCULTOS_NO_FINANCAS = [...ROTAS_LEGADAS];
const hrefs = (itens: readonly { href?: string }[]) => itens.flatMap((i) => (i.href ? [i.href.split('?')[0] ?? i.href] : []));

describe('Sidebar por APP_MODE', () => {
  it('modo padrão: mesma Sidebar do modo Finanças (os módulos legados saíram do código)', () => {
    expect(secoesSidebar('padrao')).toEqual(secoesSidebar('financas'));
    for (const href of secoesSidebar('padrao').flatMap((s) => hrefs(s.items))) expect(isRotaLegada(href)).toBe(false);
  });

  it('modo finanças: Finanças (com Painel) + Saúde (Treino, Dieta, Plano, Calorias e peso)', () => {
    const secoes = secoesSidebar('financas');
    expect(secoes.map((s) => s.label)).toEqual(['Finanças', 'Saúde']);
    const todos = secoes.flatMap((s) => hrefs(s.items));
    expect(todos).toEqual([
      '/financas', '/financas/relatorio', '/financas/gastos', '/financas/contas', '/assinaturas', '/financas/orcamento', '/financas/metas', '/financas/carteiras',
      '/treinos', '/refeicoes', '/treinos/plano', '/saude',
    ]);
    for (const href of todos) expect(isRotaVisivel(href, 'financas')).toBe(true);
    for (const oculto of OCULTOS_NO_FINANCAS) expect(todos).not.toContain(oculto);
  });
});

describe('BottomNav modo finanças', () => {
  it('Início, Treino, Dieta e Painel; sem "Mais" (o ☰ do topo já abre o menu)', () => {
    const itens = itensBottomFinancas();
    expect(itens.map((i) => i.label)).toEqual(['Início', 'Treino', 'Dieta', 'Painel']);
    expect(hrefs(itens)).toEqual(['/financas', '/treinos', '/refeicoes', '/financas/relatorio']);
    expect(itens.map((i) => i.icone)).toEqual(['house', 'dumbbell', 'salad', 'layout-dashboard']);
    expect(itens.map((i) => i.label)).not.toContain('Mais');
  });

  it('Treino não acende no Plano de treino (que mora no menu)', () => {
    const treino = itensBottomFinancas()[1]!;
    expect(isNavAtivo('/treinos', treino)).toBe(true);
    expect(isNavAtivo('/treinos/plano', treino)).toBe(false);
  });

  it('Saúde fica no menu; a /dieta antiga é rota legada (redireciona), não a /saude/dieta', () => {
    for (const r of ['/saude', '/saude/dieta', '/saude/peso', '/treinos/plano', '/refeicoes']) {
      expect(isRotaVisivel(r, 'financas')).toBe(true);
      expect(isRotaLegada(r)).toBe(false);
    }
    expect(isRotaLegada('/dieta')).toBe(true);
  });

  it('todas apontam para rotas visíveis; sem "+" nem Chat na barra', () => {
    const itens = itensBottomFinancas();
    for (const href of hrefs(itens)) expect(isRotaVisivel(href, 'financas')).toBe(true);
    expect(itens.map((i) => i.label)).not.toContain('Lançar');
    expect(itens.map((i) => i.label)).not.toContain('Chat');
    expect(HREF_NOVA_CONTA).toBe('/financas/contas?nova=1');
  });

  it('modo padrão usa a mesma barra e o mesmo ☰ (sem "Mais" nem rotas legadas)', () => {
    expect(itensBottomFinancas('padrao')).toEqual(itensBottomFinancas('financas'));
    expect(secoesDrawer('padrao')).toEqual(secoesDrawer('financas'));
  });
});

describe('Drawer', () => {
  it('modo finanças: o que não está na barra, em seções Finanças / Saúde / Conta', () => {
    const secoes = secoesDrawer('financas');
    expect(secoes.map((s) => s.label)).toEqual(['Finanças', 'Saúde', 'Conta']);
    const todos = hrefs(itensDrawer('financas'));
    expect(todos).toEqual([
      '/financas/gastos', '/financas/contas', '/assinaturas', '/financas/orcamento', '/financas/metas', '/financas/carteiras',
      '/treinos/plano', '/saude', '/configuracoes',
    ]);
    // Nada duplicado com a barra de baixo.
    for (const aba of hrefs(itensBottomFinancas())) expect(todos).not.toContain(aba);
    for (const href of todos) expect(isRotaVisivel(href, 'financas')).toBe(true);
    for (const oculto of OCULTOS_NO_FINANCAS) expect(todos).not.toContain(oculto);
  });
});

describe('isNavAtivo', () => {
  it('exato não acende nas subrotas; demais acendem; query é ignorada', () => {
    expect(isNavAtivo('/financas', { href: '/financas', exato: true })).toBe(true);
    expect(isNavAtivo('/financas/contas', { href: '/financas', exato: true })).toBe(false);
    expect(isNavAtivo('/financas/contas/abc', { href: '/financas/contas' })).toBe(true);
    expect(isNavAtivo('/financas/contas', { href: HREF_NOVA_CONTA })).toBe(true);
    expect(isNavAtivo('/financas/contasx', { href: '/financas/contas' })).toBe(false);
  });

  it('pathname com query string (filtros de Gastos) continua ativo', () => {
    const gastos = { href: '/financas/gastos' };
    expect(isNavAtivo('/financas/gastos?mes=2026-10', gastos)).toBe(true);
    expect(isNavAtivo('/financas/gastos?aba=analise&categoria=Mercado', gastos)).toBe(true);
    expect(isNavAtivo('/financas?mes=2026-10', { href: '/financas', exato: true })).toBe(true);
    expect(isNavAtivo('/financas/gastos?mes=2026-10', { href: '/financas', exato: true })).toBe(false);
  });
});
