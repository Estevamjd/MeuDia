'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { MarcaAuth } from '../../components/auth/MarcaAuth';
import { esquecerToken, guardarToken, MENSAGEM_VINCULO, tokenGuardado, tokenValido, vincularWhatsapp } from '../../lib/whatsapp/vinculo';

type Estado = 'carregando' | 'sem_conta' | 'ligado' | 'invalido' | { erro: string };

/** Destino do link que o bot manda no fim do onboarding. Pública: quem não tem conta cria e o vínculo acontece depois. */
export default function WhatsappPage() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado>('carregando');

  useEffect(() => {
    const t = params.get('t');
    if (tokenValido(t)) guardarToken(t);
    const token = tokenValido(t) ? t : tokenGuardado();
    if (!token) return setEstado('invalido');
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setEstado('sem_conta');
      const r = await vincularWhatsapp(supabase, token);
      if (r.ok) {
        esquecerToken();
        setEstado('ligado');
      } else {
        if (r.motivo !== 'falhou') esquecerToken();
        setEstado({ erro: MENSAGEM_VINCULO[r.motivo] });
      }
    });
  }, [params]);

  return (
    <main className="astrog-ceu bg-glow-orbs flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md animate-fadeSlide">
        <MarcaAuth titulo="Seu MeuDia no WhatsApp" subtitulo="Falta só um passo para ligar sua conta." />
        <section className="lap-cartao rounded-2xl p-6 text-center sm:p-8" aria-live="polite">
          {estado === 'carregando' && <p className="text-sm text-muted">Só um instante…</p>}

          {estado === 'sem_conta' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Crie sua conta (leva 1 minuto) ou entre na que você já tem. Assim que entrar, eu ligo este WhatsApp
                e trago o que você me contou por lá.
              </p>
              <Link href="/registro" className="block rounded-xl bg-accent px-5 py-3 font-medium text-accent-fg">
                Criar minha conta
              </Link>
              <Link href="/login" className="block rounded-xl px-5 py-3 text-sm text-muted hover:bg-card2 hover:text-text">
                Já tenho conta
              </Link>
            </div>
          )}

          {estado === 'ligado' && (
            <div className="space-y-4">
              <MessageCircle className="mx-auto text-green" size={32} aria-hidden="true" />
              <p className="text-base text-text">WhatsApp ligado! 🎉</p>
              <p className="text-sm text-muted">Agora é só mandar no WhatsApp: “gastei 30 no uber”, “treinei peito 40min”.</p>
              <Link href="/inicio" className="block rounded-xl bg-accent px-5 py-3 font-medium text-accent-fg">
                Abrir o painel
              </Link>
            </div>
          )}

          {estado === 'invalido' && (
            <p className="text-sm text-muted">Link incompleto. Mande “oi” para o MeuDia no WhatsApp que eu te mando um novo.</p>
          )}

          {typeof estado === 'object' && (
            <div className="space-y-4">
              <p className="text-sm text-red" role="alert">{estado.erro}</p>
              <Link href="/inicio" className="block text-sm text-accent hover:underline">Ir para o painel</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
