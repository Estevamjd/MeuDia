import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080810',
        surface: '#10101a',
        card: '#16161f',
        card2: '#1c1c28',
        border: 'rgba(255,255,255,0.07)',
        accent: '#7c6aff',
        accent2: '#ff6a9a',
        accent3: '#6affda',
        orange: '#ff9f4a',
        green: '#4ade80',
        yellow: '#fbbf24',
        red: '#f87171',
        text: '#eeeef8',
        muted: '#65657a',
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'Syne', 'sans-serif'],
        dm: ['var(--font-dm)', 'DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      keyframes: {
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
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
      },
    },
  },
  plugins: [],
};

export default config;
