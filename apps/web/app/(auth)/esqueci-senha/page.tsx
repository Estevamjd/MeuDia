'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { MarcaAuth } from '../../../components/auth/MarcaAuth';
import { createRecuperacaoClient } from '../../../lib/supabase/recuperacao-client';
import { MENSAGEM_LINK_INVALIDO, getResetRedirectUrl, resultadoPedido } from '../../../lib/auth/recuperacao';

const pedidoSchema = z.object({
  email: z.string().trim().email('Email inválido'),
});

type PedidoForm = z.infer<typeof pedidoSchema>;

export default function EsqueciSenhaPage() {
  return (
    <Suspense>
      <EsqueciSenhaContent />
    </Suspense>
  );
}

function EsqueciSenhaContent() {
  const searchParams = useSearchParams();
  const [aviso, setAviso] = useState(searchParams.get('link') === 'invalido' ? MENSAGEM_LINK_INVALIDO : '');
  const [enviado, setEnviado] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PedidoForm>({ resolver: zodResolver(pedidoSchema) });

  const onSubmit = async ({ email }: PedidoForm) => {
    setAviso('');
    setEnviado('');
    const supabase = createRecuperacaoClient();
    if (!supabase) {
      setAviso('Serviço indisponível. Tente de novo mais tarde.');
      return;
    }
    let error: { message?: string; code?: string; status?: number } | null = null;
    try {
      ({ error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl(window.location.origin),
      }));
    } catch {
      error = { status: 0, message: 'rede' };
    }
    const r = resultadoPedido(error);
    if (r.ok) setEnviado(r.mensagem);
    else setAviso(r.mensagem);
  };

  return (
    <main className="astrog-ceu bg-glow-orbs flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md animate-fadeSlide">
        <MarcaAuth titulo="Esqueceu a senha?" subtitulo="Informe seu e-mail e enviamos um link para criar uma nova" />

        <form onSubmit={handleSubmit(onSubmit)} className="lap-cartao rounded-2xl p-6 sm:p-8" noValidate>
          {aviso && (
            <div className="mb-4 rounded-lg border border-red/30 bg-red/[0.08] px-4 py-3 text-sm text-red" role="alert">
              {aviso}
            </div>
          )}

          {enviado ? (
            <div className="rounded-lg border border-green/30 bg-green/[0.08] px-4 py-3 text-sm text-green" role="status">
              {enviado}
            </div>
          ) : (
            <>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                icon={<Mail size={16} />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Button type="submit" isLoading={isSubmitting} className="mt-6 w-full">
                Enviar link
              </Button>
            </>
          )}

          <p className="mt-4 text-center text-sm text-muted">
            Lembrou a senha?{' '}
            <Link href="/login" className="text-accent transition-colors hover:text-accent2">
              Voltar para o login
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
