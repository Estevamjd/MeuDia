import { filtrarPorModo, rotaInicial, type AppMode } from './app-mode';

const ATALHOS = [
  { name: 'Treino', url: '/treinos', description: 'Registrar o treino de hoje' },
  { name: 'Financas', url: '/financas', description: 'Ver financas do mes' },
];

/** Sobe a cada troca de ícone: a query nova faz o celular com o app instalado baixar o ícone de novo. */
export const VERSAO_ICONE = '3c';

const ICONES = [192, 512].flatMap((tamanho) =>
  (['any', 'maskable'] as const).map((purpose) => ({
    // O ícone vai até a borda com a marca na zona segura, então serve como `any` e `maskable`.
    src: `/icons/icon-${tamanho}${purpose === 'maskable' && tamanho === 512 ? '-maskable' : ''}.png?v=${VERSAO_ICONE}`,
    sizes: `${tamanho}x${tamanho}`,
    type: 'image/png',
    purpose,
  })),
);

/** Manifest do PWA gerado no servidor: `start_url` e `shortcuts` seguem o APP_MODE. */
export function buildManifest(mode: AppMode) {
  return {
    name: 'MeuDia - Assistente Pessoal',
    short_name: 'MeuDia',
    description: 'Seu assistente pessoal de financas e saude. Gastos, contas, metas, treinos e dieta.',
    start_url: rotaInicial(mode),
    display: 'standalone',
    orientation: 'portrait',
    // Mesmo navy do ícone e das splash (sem flash de tom ao abrir o PWA); a barra segue o fundo do app.
    background_color: '#0a0f1c',
    theme_color: '#050a16',
    categories: mode === 'financas' ? ['finance'] : ['finance', 'health', 'fitness'],
    lang: 'pt-BR',
    icons: ICONES,
    screenshots: [],
    shortcuts: filtrarPorModo(ATALHOS, mode),
  };
}
