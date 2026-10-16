import { filtrarPorModo, rotaInicial, type AppMode } from './app-mode';

const ATALHOS = [
  { name: 'Treinos', url: '/treinos', description: 'Ver treinos do dia' },
  { name: 'Habitos', url: '/habitos', description: 'Marcar habitos de hoje' },
  { name: 'Notas', url: '/notas', description: 'Abrir bloco de notas' },
  { name: 'Financas', url: '/financas', description: 'Ver financas do mes' },
  { name: 'Agenda', url: '/agenda', description: 'Ver compromissos' },
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
    description: 'Seu assistente pessoal de produtividade e saude. Treinos, habitos, notas, financas e mais.',
    start_url: rotaInicial(mode),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080810',
    theme_color: '#7c6aff',
    categories: mode === 'financas' ? ['finance'] : ['health', 'fitness', 'productivity', 'finance'],
    lang: 'pt-BR',
    icons: ICONES,
    screenshots: [],
    shortcuts: filtrarPorModo(ATALHOS, mode),
  };
}
