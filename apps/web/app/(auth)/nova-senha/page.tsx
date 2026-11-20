'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { destinoComLimite } from '../destino-com-limite';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { MarcaAuth } from '../../../components/auth/MarcaAuth';
import {
  CHAVE_RECUPERACAO,
  ESQUECI_SENHA_PATH,
  MENSAGEM_LINK_INVALIDO,
  NOVA_SENHA_PATH,
  lerParametrosRecuperacao,
  mensagemErroNovaSenha,
} from '../../../lib/auth/recuperacao';

// Mesma regra do cadastro.
const novaSenhaSchema = z
  .object({
    password: z.string().min(8, 'Mínimo de 8 caracteres').regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Deve conter pelo menos uma letra e um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'As senhas não coincidem', path: ['confirmPassword'] });

type NovaSenhaForm = z.infer<typeof novaSenhaSchema>;
type Estado = 'verificando' | 'pronto' | 'invalido' | 'salva';

export default function NovaSenhaPage() {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [erro, setErro] = useState('');
  const [navegando, setNavegando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NovaSenhaForm>({ resolver: zodResolver(novaSenhaSchema) });

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();
    const params = lerParametrosRecuperacao(window.location.hash, window.location.search);
    // Tira os tokens da barra de endereço/histórico logo de cara.
    if (params.tipo !== 'nenhum') window.history.replaceState(null, '', NOVA_SENHA_PATH);

    const aceitar = () => {
      window.sessionStorage.setItem(CHAVE_RECUPERACAO, '1');
      if (ativo) setEstado('pronto');
    };
    const recusar = () => {
      window.sessionStorage.removeItem(CHAVE_RECUPERACAO);
      if (ativo) setEstado('invalido');
    };

    void (async () => {
      if (!supabase) return recusar();
      try {
        switch (params.tipo) {
          case 'implicito': {
            const { error } = await supabase.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken });
            return error ? recusar() : aceitar();
          }
          case 'token_hash': {
            const { error } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: 'recovery' });
            return error ? recusar() : aceitar();
          }
          case 'codigo': {
            // O cliente do @supabase/ssr já troca o `?code=` sozinho ao iniciar; só confere se deu sessão.
            const { data } = await supabase.auth.getSession();
            if (data.session) return aceitar();
            const { error } = await supabase.auth.exchangeCodeForSession(params.code);
            return error ? recusar() : aceitar();
          }
          case 'erro':
            return recusar();
          default: {
            // Recarregou a página depois de abrir o link: segue valendo nesta aba se ainda há sessão.
            if (window.sessionStorage.getItem(CHAVE_RECUPERACAO) !== '1') return recusar();
            const { data } = await supabase.auth.getSession();
            return data.session ? aceitar() : recusar();
          }
        }
      } catch {
        recusar();
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const onSubmit = async ({ password }: NovaSenhaForm) => {
    setErro('');
    const supabase = createClient();
    if (!supabase) {
      setErro('Serviço indisponível. Tente de novo mais tarde.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const msg = mensagemErroNovaSenha(error);
      if (msg === MENSAGEM_LINK_INVALIDO) {
        window.sessionStorage.removeItem(CHAVE_RECUPERACAO);
        setEstado('invalido');
        return;
      }
      setErro(msg);
      return;
    }
    window.sessionStorage.removeItem(CHAVE_RECUPERACAO);
    setEstado('salva');
  };

  return (
    <main className="astrog-ceu bg-glow-orbs flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md animate-fadeSlide">
        <MarcaAuth titulo="Criar nova senha" subtitulo="Escolha uma senha nova para entrar no MeuDia" />

        <div className="lap-cartao rounded-2xl p-6 sm:p-8">
          {estado === 'verificando' && (
            <p className="text-center text-sm text-muted" role="status" aria-busy="true">
              Conferindo seu link…
            </p>
          )}

          {estado === 'invalido' && (
            <>
              <div className="rounded-lg border border-red/30 bg-red/[0.08] px-4 py-3 text-sm text-red" role="alert">
                {MENSAGEM_LINK_INVALIDO}
              </div>
              <Link
                href={ESQUECI_SENHA_PATH}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg shadow-[0_0_24px_-6px_rgb(var(--c-brilho)/0.55)] transition-all duration-200 hover:bg-[#5cefff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Pedir novo link
              </Link>
            </>
          )}

          {estado === 'salva' && (
            <>
              <div className="rounded-lg border border-green/30 bg-green/[0.08] px-4 py-3 text-sm text-green" role="status">
                Senha alterada! Você já está dentro da sua conta.
              </div>
              <Button
                type="button"
                className="mt-6 w-full"
                isLoading={navegando}
                onClick={async () => {
                  setNavegando(true);
                  try {
                    const destino = await destinoComLimite();
                    window.location.assign(destino);
                  } finally {
                    setNavegando(false);
                  }
                }}
              >
                Ir para o MeuDia
              </Button>
            </>
          )}

          {estado === 'pronto' && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {erro && (
                <div className="mb-4 rounded-lg border border-red/30 bg-red/[0.08] px-4 py-3 text-sm text-red" role="alert">
                  {erro}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Input
                    label="Nova senha"
                    type={mostrar ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    icon={<Lock size={16} />}
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((s) => !s)}
                    className="absolute right-3 top-9 text-muted transition-colors hover:text-text"
                    aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Input
                  label="Confirmar nova senha"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  icon={<Lock size={16} />}
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>
              <p className="mt-3 text-xs text-muted">Pelo menos 8 caracteres, com letras e números.</p>
              <Button type="submit" isLoading={isSubmitting} className="mt-6 w-full">
                Salvar nova senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
