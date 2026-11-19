import { describe, expect, it } from 'vitest';
import { isRotaVisivel } from '../app-mode';
import {
  BOTTOM_TABS_PADRAO,
  HREF_NOVA_CONTA,
  MENU_MAIS_PADRAO,
  isNavAtivo,
  itensBottomFinancas,
  itensDrawer,
  secoesDrawer,
  secoesSidebar,
} from '../navegacao';

// /treinos saiu: Saúde e Treino aparece para todos (decisão do Estevam, 04/11/2026). Dieta entra na F3.
const OCULTOS_NO_FINANCAS = ['/inicio', '/agenda', '/habitos', '/dieta', '/compras', '/medicamentos', '/notas', '/veiculo'];
const hrefs = (itens: readonly { href?: string }[]) => itens.flatMap((i) => (i.href ? [i.href.split('?')[0] ?? i.href] : []));

describe('Sidebar por APP_MODE', () => {
  it('modo padrão: inalterada (Geral + Saúde, todos os módulos)', () => {
    const secoes = secoesSidebar('padrao');
    expect(secoes.map((s) => s.label)).toEqual(['Geral', 'Saúde']);
    expect(secoes.flatMap((s) => hrefs(s.items))).toEqual([
      '/inicio', '/notas', '/agenda', '/financas', '/compras', '/habitos', '/veiculo', '/assinaturas',
      '/saude', '/treinos', '/dieta', '/medicamentos',
    ]);
  });

  it('modo finanças: Finanças (com Relatório) + Saúde (Treino, Dieta, Plano, Calorias e peso)', () => {
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
  it('Início, Treino, Dieta e Relatório; sem "Mais" (o ☰ do topo já abre o menu)', () => {
    const itens = itensBottomFinancas();
    expect(itens.map((i) => i.label)).toEqual(['Início', 'Treino', 'Dieta', 'Relatório']);
    expect(hrefs(itens)).toEqual(['/financas', '/treinos', '/refeicoes', '/financas/relatorio']);
    expect(itens.map((i) => i.icone)).toEqual(['house', 'dumbbell', 'salad', 'file-text']);
    expect(itens.map((i) => i.label)).not.toContain('Mais');
  });

  it('Treino não acende no Plano de treino (que mora no menu)', () => {
    const treino = itensBottomFinancas()[1]!;
    expect(isNavAtivo('/treinos', treino)).toBe(true);
    expect(isNavAtivo('/treinos/plano', treino)).toBe(false);
  });

  it('Saúde antiga fica no menu; a /dieta antiga não entra no modo Finanças', () => {
    for (const r of ['/saude', '/saude/dieta', '/saude/peso', '/treinos/plano', '/refeicoes']) expect(isRotaVisivel(r, 'financas')).toBe(true);
    expect(isRotaVisivel('/dieta', 'financas')).toBe(false);
  });

  it('todas apontam para rotas visíveis; sem "+" nem Chat na barra', () => {
    const itens = itensBottomFinancas();
    for (const href of hrefs(itens)) expect(isRotaVisivel(href, 'financas')).toBe(true);
    expect(itens.map((i) => i.label)).not.toContain('Lançar');
    expect(itens.map((i) => i.label)).not.toContain('Chat');
    expect(HREF_NOVA_CONTA).toBe('/financas/contas?nova=1');
  });

  it('modo padrão continua com Início/Agenda/Hábitos/Finanças/Mais', () => {
    expect(hrefs(BOTTOM_TABS_PADRAO)).toEqual(['/inicio', '/agenda', '/habitos', '/financas', '/mais']);
    expect(hrefs(MENU_MAIS_PADRAO)).toContain('/treinos');
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
