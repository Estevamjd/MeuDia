'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

const registroSchema = z
  .object({
    nome: z.string().min(2, 'Mínimo de 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo de 8 caracteres').regex(
      /^(?=.*[a-zA-Z])(?=.*\d)/,
      'Deve conter pelo menos uma letra e um número'
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type RegistroForm = z.infer<typeof registroSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
  });

  const onSubmit = async (data: RegistroForm) => {
    setServerError('');
    if (!supabase) {
      setServerError('Serviço indisponível. Verifique a configuração.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { nome: data.nome },
      },
    });

    if (error) {
      setServerError(
        error.message === 'User already registered'
          ? 'Este email já está cadastrado'
          : 'Erro ao criar conta. Tente novamente.',
      );
      return;
    }

    router.push('/onboarding');
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md animate-fadeSlide">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-accent to-accent2 bg-clip-text font-syne text-3xl font-bold text-transparent">
            MeuDia
          </h1>
          <p className="mt-2 text-sm text-muted">Crie sua conta e comece a organizar seu dia</p>
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

          <div className="flex flex-col gap-4">
            <Input
              label="Nome"
              type="text"
              placeholder="Seu nome"
              icon={<User size={16} />}
              error={errors.nome?.message}
              {...register('nome')}
            />

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

            <Input
              label="Confirmar senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••"
              icon={<Lock size={16} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <Button type="submit" isLoading={isSubmitting} className="mt-6 w-full">
            Criar conta
          </Button>

          <p className="mt-4 text-center text-sm text-muted">
            Já tem conta?{' '}
            <Link href="/login" className="text-accent transition-colors hover:text-accent2">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
