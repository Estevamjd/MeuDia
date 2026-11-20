/**
 * Fonte única do modo do app (SPEC 5.7). `APP_MODE` é env de servidor; o valor
 * chega ao cliente pelo layout raiz (AppModeProvider), sem `NEXT_PUBLIC_`.
 */
export type AppMode = 'padrao' | 'financas';

/** Rotas de módulo (prefixos). Rotas fora desta lista (login, api, onboarding...) nunca são ocultadas. */
export const ROTAS_MODULOS = [
  '/financas',
  '/assinaturas',
  '/saude',
  '/treinos',
  '/refeicoes',
  '/configuracoes',
] as const;

/**
 * Os dois modos mostram os mesmos módulos desde a faxina dos módulos legados (20/11/2026). `APP_MODE` segue lido
 * em runtime e ainda muda detalhes de tela (título da Início, barra, FAB, categorias do manifest).
 * Saúde e Treino aparecem para todos (decisão do Estevam, 04/11/2026); /refeicoes = aba Dieta (19/11/2026).
 */
export const MODULOS_VISIVEIS: Record<AppMode, readonly string[]> = {
  padrao: ROTAS_MODULOS,
  financas: ROTAS_MODULOS,
};

/**
 * Módulos do antigo modo padrão, removidos do código em 20/11/2026 (branch `arquivo/legado-2026-11`). As tabelas
 * continuam no banco (sem migration); excluir conta as apaga pelas cascatas do Auth; o CSV de "Baixar meus dados"
 * segue só com finanças (`exportar-dados.ts`), sem essas tabelas. URL antiga, com ou sem subcaminho, vai para
 * /financas (307 em `next.config.js`, `redirects`), nunca 404.
 */
export const ROTAS_LEGADAS = [
  '/inicio',
  '/agenda',
  '/habitos',
  '/notas',
  '/compras',
  '/medicamentos',
  '/veiculo',
  '/dieta',
] as const;

export const DESTINO_ROTA_LEGADA = '/financas';

const casaPrefixo = (pathname: string, prefixo: string) =>
  pathname === prefixo || pathname.startsWith(prefixo + '/');

export function isRotaLegada(pathname: string): boolean {
  const rota = pathname.split(/[?#]/)[0] ?? pathname;
  return ROTAS_LEGADAS.some((r) => casaPrefixo(rota, r));
}

export function getAppMode(valor: string | undefined = process.env.APP_MODE): AppMode {
  return valor?.trim().toLowerCase() === 'financas' ? 'financas' : 'padrao';
}

/** Rota inicial dos dois modos (a Início antiga saiu com os módulos legados). */
export function rotaInicial(_mode: AppMode): string {
  return '/financas';
}

export function isRotaVisivel(pathname: string, mode: AppMode): boolean {
  const modulo = ROTAS_MODULOS.find((r) => casaPrefixo(pathname, r));
  if (!modulo) return true;
  return MODULOS_VISIVEIS[mode].includes(modulo);
}

/** Destino do redirect do middleware quando a rota está oculta ou é legada; `null` = segue. */
export function redirecionamentoModo(pathname: string, mode: AppMode): string | null {
  if (isRotaLegada(pathname)) return DESTINO_ROTA_LEGADA;
  return isRotaVisivel(pathname, mode) ? null : rotaInicial(mode);
}

export function filtrarPorModo<T extends { href?: string; url?: string }>(itens: readonly T[], mode: AppMode): T[] {
  return itens.filter((item) => {
    const rota = item.href ?? item.url ?? '';
    return !isRotaLegada(rota) && isRotaVisivel(rota, mode);
  });
}
