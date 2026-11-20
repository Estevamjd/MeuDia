import { filtrarPorModo, rotaInicial, type AppMode } from './app-mode';

const ATALHOS = [
  { name: 'Treino', url: '/treinos', description: 'Registrar o treino de hoje' },
  { name: 'Financas', url: '/financas', description: 'Ver financas do mes' },
];

const ICONES = [192, 512].flatMap((tamanho) =>
  (['any', 'maskable'] as const).map((purpose) => ({
    src: `/icons/icon-${tamanho}.png`,
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
    background_color: '#050a16',
    theme_color: '#050a16',
    categories: mode === 'financas' ? ['finance'] : ['finance', 'health', 'fitness'],
    lang: 'pt-BR',
    icons: ICONES,
    screenshots: [],
    shortcuts: filtrarPorModo(ATALHOS, mode),
  };
}
