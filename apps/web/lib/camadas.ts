/**
 * Escala única de z-index do app. É a fonte do `theme.zIndex` do Tailwind (`z-header`, `z-nav`...):
 * componentes usam só essas classes, nunca `z-40`/`z-[60]` soltos.
 *
 * Quem fica por cima de quem (de baixo para cima):
 * - header: Topbar (sticky).
 * - banner: banner "Instalar MeuDia", acima do conteúdo e abaixo da BottomNav.
 * - nav: BottomNav e o menu "Mais" dela.
 * - modal: Modal, NavDrawer e folhas comuns (portal no body).
 * - agente: painel do assistente (portal no body). Acima de tudo que é fixo no layout, para o X nunca ficar coberto.
 * - toast: avisos curtos e o indicador offline; ficam no rodapé e não alcançam o header do painel.
 * - sobreposicao: telas cheias que pedem atenção total (timer de descanso).
 *
 * Elementos em portal no body só competem com estes números se também estiverem na raiz:
 * dentro do layout do dashboard (`relative z-10`) qualquer z-index fica preso abaixo deles.
 */
export const CAMADAS = {
  header: 20,
  banner: 30,
  nav: 40,
  modal: 50,
  agente: 60,
  toast: 70,
  sobreposicao: 80,
} as const;

export type Camada = keyof typeof CAMADAS;

/** Formato do `theme.zIndex` do Tailwind (valores em string). */
export const zIndexTailwind = Object.fromEntries(
  Object.entries(CAMADAS).map(([nome, valor]) => [nome, String(valor)]),
) as Record<Camada, string>;
