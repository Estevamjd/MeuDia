import type { Config } from 'tailwindcss';
import { zIndexTailwind } from './lib/camadas';

/** Cor de tema: `rgb(var(--c-nome) / alfa)`. */
const c = (nome: string) => `rgb(var(--c-${nome}) / <alpha-value>)`;

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Astro G dark (Mestres CRM): azul-noite + ciano #00e5ff. Os nomes antigos seguem valendo em todo o app.
      colors: {
        // Cada cor vem de uma variável RGB em globals.css (:root = escuro, [data-mode="light"] = claro), para o
        // modificador de opacidade (bg-accent/20) seguir valendo nos dois temas.
        bg: c('bg'),
        'bg-deep': c('bg-deep'),
        surface: c('surface'),
        card: c('card'),
        card2: c('card2'),
        border: c('border'),
        // Fundo dos campos de texto.
        campo: c('campo'),
        accent: c('accent'),
        // Texto sobre o accent (botão primário, chips ativos): 13:1 no escuro, branco no claro.
        'accent-fg': c('accent-fg'),
        accent2: c('accent2'),
        accent3: c('accent3'),
        orange: c('orange'),
        green: c('green'),
        'green-dark': c('green-dark'),
        yellow: c('yellow'),
        red: c('red'),
        text: c('text'),
        // Texto secundário: 6,9:1 no card escuro; 6,3:1 no card claro.
        muted: c('muted'),
        'muted-text': c('muted-text'),
        // Trilhos e superfícies discretas (barras vazias, ícones de linha).
        trilho: c('trilho'),
        // Cores das notas (iguais nos dois temas; cada uma distinta das outras e da cor de alerta).
        'nota-ciano': '#22d3ee',
        'nota-roxo': '#a78bfa',
        'nota-verde': '#34d399',
        'nota-laranja': '#fb923c',
        'nota-vermelho': '#f87171',
        'nota-amarelo': '#facc15',
      },
      fontFamily: {
        syne: ['var(--font-geist)', 'Geist', 'system-ui', 'sans-serif'],
        dm: ['var(--font-geist)', 'Geist', 'system-ui', 'sans-serif'],
        sans: ['var(--font-geist)', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        heroi: '20px',
      },
      // Escala única de camadas (lib/camadas.ts): z-header, z-banner, z-nav, z-modal, z-agente, z-toast, z-sobreposicao.
      zIndex: zIndexTailwind,
      keyframes: {
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeSlide: 'fadeSlide 0.35s ease',
        slideIn: 'slideIn 0.3s ease',
        slideOut: 'slideOut 0.3s ease',
        slideUp: 'slideUp 0.3s ease',
      },
    },
  },
  plugins: [],
};

export default config;
