import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { SCRIPT_TEMA } from '../lib/tema';

// Geist / Geist Mono auto-hospedadas (OFL, app/fonts): mesma tipografia do Mestres CRM (Astro G), sem Google Fonts.
// As variáveis antigas (--font-dm / --font-syne) apontam para a Geist para todas as classes existentes seguirem valendo.
const geist = localFont({
  src: './fonts/Geist-Variable.woff2',
  weight: '100 900',
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050a16',
};

export const metadata: Metadata = {
  title: 'MeuDia — Assistente Pessoal',
  description: 'Seu assistente pessoal de produtividade e saude. Treinos, habitos, notas, financas e mais.',
  // Gerado no servidor (app/manifest.webmanifest/route.ts) para filtrar atalhos pelo APP_MODE.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MeuDia',
    startupImage: [
      {
        url: '/icons/splash-1290x2796.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/splash-1179x2556.png',
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/splash-1170x2532.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/splash-1080x2340.png',
        media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)',
      },
      {
        url: '/icons/splash-750x1334.png',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Sem noStore aqui: o layout raiz é estático para as páginas públicas (login, termos…) poderem ser pré-renderizadas.
  // APP_MODE/VAPID são lidos por request em RuntimeAppConfig, nos layouts de (dashboard) e de onboarding.
  return (
    // data-mode e color-scheme são postos pelo SCRIPT_TEMA antes da hidratação (por isso o suppressHydrationWarning).
    <html lang="pt-BR" data-mode="dark" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Tema antes da 1ª pintura: sem piscar o escuro para quem escolheu claro. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="astrog-ceu bg-bg font-dm text-text antialiased">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(reg => {
                    reg.addEventListener('updatefound', () => {
                      // Só recarrega em atualização (já havia SW controlando): na 1ª instalação o reload apagava o que o usuário digitava.
                      const atualizacao = !!navigator.serviceWorker.controller;
                      const newWorker = reg.installing;
                      if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'activated' && atualizacao) {
                            window.location.reload();
                          }
                        });
                      }
                    });
                  }).catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
