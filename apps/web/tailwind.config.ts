import type { Config } from 'tailwindcss';
import { zIndexTailwind } from './lib/camadas';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Astro G dark (Mestres CRM): azul-noite + ciano #00e5ff. Os nomes antigos seguem valendo em todo o app.
      colors: {
        bg: '#050a16',
        surface: '#060b17',
        card: '#0b1220',
        card2: '#101827',
        border: '#1c2638',
        accent: '#00e5ff',
        // Texto sobre o ciano (botão primário, chips ativos): 13:1.
        'accent-fg': '#06101c',
        accent2: '#00ffa3',
        accent3: '#5cefff',
        orange: '#fab219',
        green: '#34d399',
        'green-dark': '#0ca30c',
        yellow: '#fab219',
        red: '#f87171',
        text: '#f5f6f8',
        // Texto secundário: 6,9:1 no card (#0b1220).
        muted: '#94a3b8',
        'muted-text': '#a8b4c7',
        // Trilhos e superfícies discretas (barras vazias, ícones de linha).
        trilho: '#151f31',
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
