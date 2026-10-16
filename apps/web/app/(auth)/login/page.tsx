'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
  getAuthCallbackUrl,
  getResendErrorMessage,
  isEmailNotConfirmedError,
} from '../../../lib/auth/callback';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(
    searchParams.get('erro')
      ? 'Não foi possível confirmar seu e-mail. Tente entrar ou reenviar o link.'
      : '',
  );
  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenvioSucesso, setReenvioSucesso] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const reenviarConfirmacao = async () => {
    if (!supabase || !emailNaoConfirmado) return;
    setReenviando(true);
    setServerError('');
    setReenvioSucesso('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailNaoConfirmado,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    setReenviando(false);
    if (error) {
      setServerError(getResendErrorMessage(error));
      return;
    }
    setReenvioSucesso('E-mail reenviado. Verifique sua caixa de entrada e o spam.');
  };

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    setReenvioSucesso('');
    setEmailNaoConfirmado('');
    if (!supabase) {
      setServerError('Serviço indisponível. Verifique a configuração.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (isEmailNotConfirmedError(error)) {
        setEmailNaoConfirmado(data.email);
        setServerError('Confirme seu e-mail para entrar');
        return;
      }
      setServerError(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : 'Erro ao entrar. Tente novamente.',
      );
      return;
    }

    router.push('/inicio');
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md animate-fadeSlide">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-accent to-accent2 bg-clip-text font-syne text-3xl font-bold text-transparent">
            MeuDia
          </h1>
          <p className="mt-2 text-sm text-muted">Entre na sua conta para continuar</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-card border border-border bg-card p-8"
        >
          {serverError && (
            <div className="mb-4 rounded-lg border border-red/30 bg-red/[0.08] px-4 py-3 text-sm text-red" role="alert">
              {serverError}
            </div>
          )}

          {reenvioSucesso && (
            <div className="mb-4 rounded-lg border border-green/30 bg-green/[0.08] px-4 py-3 text-sm text-green" role="status">
              {reenvioSucesso}
            </div>
          )}

          {emailNaoConfirmado && (
            <Button
              type="button"
              variant="ghost"
              isLoading={reenviando}
              onClick={reenviarConfirmacao}
              className="mb-4 w-full border border-border"
            >
              Reenviar e-mail de confirmação
            </Button>
          )}

          <div className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              icon={<Mail size={16} />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••"
                icon={<Lock size={16} />}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-9 text-muted transition-colors hover:text-text"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" isLoading={isSubmitting} className="mt-6 w-full">
            Entrar
          </Button>

          <p className="mt-4 text-center text-sm text-muted">
            Não tem conta?{' '}
            <Link href="/registro" className="text-accent transition-colors hover:text-accent2">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
