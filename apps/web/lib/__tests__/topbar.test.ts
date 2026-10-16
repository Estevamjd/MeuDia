import { expect, it } from 'vitest';
import { TOPBAR_TABS, tabsTopbar } from '../topbar';

it('modo padrão: Topbar idêntica (Início, Treinos, Notas)', () => {
  expect(tabsTopbar('padrao').map((t) => t.href)).toEqual(['/inicio', '/treinos', '/notas']);
  expect(tabsTopbar('padrao')).toEqual(TOPBAR_TABS);
});

it('modo finanças: sem Treinos, Notas nem Início (módulos ocultos)', () => {
  const hrefs = tabsTopbar('financas').map((t) => t.href);
  expect(hrefs).not.toContain('/treinos');
  expect(hrefs).not.toContain('/notas');
  expect(hrefs).not.toContain('/inicio');
  expect(hrefs).toEqual([]);
});
