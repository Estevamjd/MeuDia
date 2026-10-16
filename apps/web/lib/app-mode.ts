/**
 * Fonte única do modo do app (SPEC 5.7). `APP_MODE` é env de servidor; o valor
 * chega ao cliente pelo layout raiz (AppModeProvider), sem `NEXT_PUBLIC_`.
 */
export type AppMode = 'padrao' | 'financas';

/** Rotas de módulo (prefixos). Rotas fora desta lista (login, api, onboarding...) nunca são ocultadas. */
export const ROTAS_MODULOS = [
  '/inicio',
  '/notas',
  '/agenda',
  '/financas',
  '/compras',
  '/habitos',
  '/veiculo',
  '/assinaturas',
  '/treinos',
  '/dieta',
  '/medicamentos',
  '/configuracoes',
] as const;

export const MODULOS_VISIVEIS: Record<AppMode, readonly string[]> = {
  padrao: ROTAS_MODULOS,
  financas: ['/financas', '/assinaturas', '/configuracoes'],
};

export function getAppMode(valor: string | undefined = process.env.APP_MODE): AppMode {
  return valor?.trim().toLowerCase() === 'financas' ? 'financas' : 'padrao';
}

export function rotaInicial(mode: AppMode): string {
  return mode === 'financas' ? '/financas' : '/inicio';
}

const casaPrefixo = (pathname: string, prefixo: string) =>
  pathname === prefixo || pathname.startsWith(prefixo + '/');

export function isRotaVisivel(pathname: string, mode: AppMode): boolean {
  const modulo = ROTAS_MODULOS.find((r) => casaPrefixo(pathname, r));
  if (!modulo) return true;
  return MODULOS_VISIVEIS[mode].includes(modulo);
}

/** Destino do redirect do middleware quando a rota está oculta; `null` = segue. */
export function redirecionamentoModo(pathname: string, mode: AppMode): string | null {
  return isRotaVisivel(pathname, mode) ? null : rotaInicial(mode);
}

export function filtrarPorModo<T extends { href?: string; url?: string }>(itens: readonly T[], mode: AppMode): T[] {
  return itens.filter((item) => isRotaVisivel(item.href ?? item.url ?? '', mode));
}
