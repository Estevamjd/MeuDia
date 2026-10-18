import { describe, expect, it } from 'vitest';
import { isRotaVisivel } from '../app-mode';
import {
  BOTTOM_TABS_PADRAO,
  HREF_NOVA_CONTA,
  MENU_MAIS_PADRAO,
  isNavAtivo,
  itensBottomFinancas,
  itensDrawer,
  secoesSidebar,
} from '../navegacao';

const OCULTOS_NO_FINANCAS = ['/inicio', '/agenda', '/habitos', '/treinos', '/dieta', '/compras', '/medicamentos', '/notas', '/veiculo'];
const hrefs = (itens: readonly { href?: string }[]) => itens.flatMap((i) => (i.href ? [i.href.split('?')[0] ?? i.href] : []));

describe('Sidebar por APP_MODE', () => {
  it('modo padrão: inalterada (Geral + Saúde, todos os módulos)', () => {
    const secoes = secoesSidebar('padrao');
    expect(secoes.map((s) => s.label)).toEqual(['Geral', 'Saúde']);
    expect(secoes.flatMap((s) => hrefs(s.items))).toEqual([
      '/inicio', '/notas', '/agenda', '/financas', '/compras', '/habitos', '/veiculo', '/assinaturas',
      '/treinos', '/dieta', '/medicamentos',
    ]);
  });

  it('modo finanças: só rotas de finanças', () => {
    const todos = secoesSidebar('financas').flatMap((s) => hrefs(s.items));
    expect(todos).toEqual(['/financas', '/financas/carteiras', '/financas/contas', '/financas/orcamento', '/financas/metas', '/assinaturas']);
    for (const oculto of OCULTOS_NO_FINANCAS) expect(todos).not.toContain(oculto);
  });
});

describe('BottomNav modo finanças', () => {
  it('Início, Contas, + Lançar, Orçamento e Chat (nessa ordem)', () => {
    const itens = itensBottomFinancas();
    expect(itens.map((i) => i.label)).toEqual(['Início', 'Contas', 'Lançar', 'Orçamento', 'Chat']);
    expect(itens.map((i) => i.tipo)).toEqual(['link', 'link', 'acoes', 'link', 'chat']);
  });

  it('todos os links apontam para rotas visíveis; "+" abre a folha de ações (sem rota)', () => {
    const itens = itensBottomFinancas();
    for (const href of hrefs(itens)) expect(isRotaVisivel(href, 'financas')).toBe(true);
    expect(itens.find((i) => i.tipo === 'acoes')).not.toHaveProperty('href');
    expect(HREF_NOVA_CONTA).toBe('/financas/contas?nova=1');
    // Chat não tem rota (/chat não existe): abre o AgentPanel.
    expect(itens.find((i) => i.tipo === 'chat')).not.toHaveProperty('href');
  });

  it('modo padrão continua com Início/Agenda/Hábitos/Finanças/Mais', () => {
    expect(hrefs(BOTTOM_TABS_PADRAO)).toEqual(['/inicio', '/agenda', '/habitos', '/financas', '/mais']);
    expect(hrefs(MENU_MAIS_PADRAO)).toContain('/treinos');
  });
});

describe('Drawer', () => {
  it('modo finanças: seções de finanças + Configurações, sem módulos ocultos', () => {
    const todos = hrefs(itensDrawer('financas'));
    expect(todos).toEqual(['/financas', '/financas/carteiras', '/financas/contas', '/financas/orcamento', '/financas/metas', '/assinaturas', '/configuracoes']);
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
});
