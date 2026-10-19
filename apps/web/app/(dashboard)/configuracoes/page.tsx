'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, AlertTriangle, Loader2, User, CalendarDays, Tags, Shield, FileText, Download, LogOut, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { rendaPrincipal } from '@meudia/shared';
import { useAuth } from '../../../hooks/useAuth';
import { useAtualizarRenda, useProfile, useRendas, useUpdateProfile } from '../../../hooks';
import { useAppMode } from '../../../components/AppModeProvider';
import { LembretesPush } from '../../../components/financas/LembretesPush';
import { Button, Input, Modal, useToast } from '../../../components/ui';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const financas = useAppMode() === 'financas';

  return (
    <div className={clsx('mx-auto max-w-xl', financas ? 'space-y-4' : 'space-y-8')}>
      <h1 className="font-syne text-2xl font-bold">Configurações</h1>

      {financas ? (
        <SecoesFinancas />
      ) : (
        <>
          {/* Info da conta */}
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-text">Conta</h2>
            <p className="text-sm text-muted">{user?.email ?? 'Carregando...'}</p>
          </section>

          {/* Links legais */}
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-text">Legal</h2>
            <div className="flex gap-4 text-sm">
              <Link href="/privacidade" className="text-accent hover:underline">
                Politica de Privacidade
              </Link>
              <Link href="/termos" className="text-accent hover:underline">
                Termos de Uso
              </Link>
            </div>
          </section>
        </>
      )}

      <ZonaDePerigo />
    </div>
  );
}

// --- Modo Finanças: Perfil → Categorias → Notificações → Privacidade → Sair (BRIEF-ICONES-ABAS §4.2) ---

const LINHA =
  'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card2 focus-visible:bg-card2 focus-visible:outline-none';

function IconeLinha({ children, perigo }: { children: ReactNode; perigo?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        perigo ? 'bg-red/[0.14] text-red' : 'bg-accent/[0.14] text-accent',
      )}
    >
      {children}
    </span>
  );
}

function ConteudoLinha({ icone, titulo, detalhe, perigo }: { icone: ReactNode; titulo: string; detalhe?: ReactNode; perigo?: boolean }) {
  return (
    <>
      <IconeLinha perigo={perigo}>{icone}</IconeLinha>
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-sm font-medium', perigo ? 'text-red' : 'text-text')}>{titulo}</span>
        {detalhe && <span className="block text-xs text-muted">{detalhe}</span>}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
    </>
  );
}

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`config-${id}`} data-secao={id} className="overflow-hidden rounded-card border border-border bg-card">
      <h2 id={`config-${id}`} className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
        {titulo}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SecoesFinancas() {
  const { signOut } = useAuth();

  return (
    <>
      <Perfil />

      <Secao id="categorias" titulo="Categorias">
        {/* Decisão 1: Orçamento (limites por categoria) mora em Config › Categorias; o menu lateral continua levando lá. */}
        <Link href="/financas/orcamento" className={LINHA}>
          <ConteudoLinha icone={<Tags size={20} />} titulo="Categorias e limites" detalhe="Limite do mês por categoria e rendas (Orçamento)" />
        </Link>
      </Secao>

      {/* O LembretesPush já é um card; a seção só dá o título. */}
      <section aria-labelledby="config-notificacoes" data-secao="notificacoes" className="space-y-2">
        <h2 id="config-notificacoes" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Notificações
        </h2>
        <LembretesPush />
      </section>

      <Secao id="privacidade" titulo="Privacidade">
        <Link href="/privacidade" className={LINHA}>
          <ConteudoLinha icone={<Shield size={20} />} titulo="Política de privacidade" />
        </Link>
        <Link href="/termos" className={LINHA}>
          <ConteudoLinha icone={<FileText size={20} />} titulo="Termos de uso" />
        </Link>
        {/* Link simples: o servidor responde com Content-Disposition (anexo), o que funciona também no Safari do iPhone. */}
        <a href="/api/financas/exportar" download className={LINHA}>
          <ConteudoLinha icone={<Download size={20} />} titulo="Baixar meus dados" detalhe="Planilha CSV com tudo o que é seu" />
        </a>
      </Secao>

      <section aria-label="Sair da conta" data-secao="sair" className="overflow-hidden rounded-card border border-border bg-card">
        <button type="button" onClick={() => void signOut()} className={LINHA}>
          <ConteudoLinha icone={<LogOut size={20} />} titulo="Sair" perigo />
        </button>
      </section>
    </>
  );
}

function Perfil() {
  const toast = useToast();
  const profile = useProfile();
  const rendas = useRendas();
  const salvarNome = useUpdateProfile();
  const atualizarRenda = useAtualizarRenda();
  const [editando, setEditando] = useState<'nome' | 'dia' | null>(null);

  const principal = rendas.data ? rendaPrincipal(rendas.data) : null;
  const nome = profile.data?.nome ?? '';

  const fechar = () => setEditando(null);

  return (
    <Secao id="perfil" titulo="Perfil">
      <button type="button" className={LINHA} onClick={() => setEditando('nome')} disabled={!profile.data}>
        <ConteudoLinha icone={<User size={20} />} titulo="Nome" detalhe={profile.data ? nome || 'Sem nome' : 'Carregando…'} />
      </button>

      {rendas.isPending ? (
        <div className={LINHA} role="status">
          <ConteudoLinha icone={<CalendarDays size={20} />} titulo="Dia do salário" detalhe="Carregando…" />
        </div>
      ) : principal ? (
        <button type="button" className={LINHA} onClick={() => setEditando('dia')}>
          <ConteudoLinha
            icone={<CalendarDays size={20} />}
            titulo="Dia do salário"
            detalhe={principal.dia_recebimento ? `Dia ${principal.dia_recebimento} · ${principal.descricao}` : `Sem dia fixo · ${principal.descricao}`}
          />
        </button>
      ) : (
        <Link href="/financas/orcamento" className={LINHA}>
          <ConteudoLinha icone={<CalendarDays size={20} />} titulo="Dia do salário" detalhe="Cadastre sua renda" />
        </Link>
      )}

      <Modal isOpen={editando === 'nome'} onClose={fechar} title="Editar nome">
        {editando === 'nome' && (
          <FormularioCampo
            id="config-nome"
            label="Seu nome"
            inicial={nome}
            isLoading={salvarNome.isPending}
            onCancel={fechar}
            validar={(v) => {
              const limpo = v.trim();
              if (!limpo || limpo.length > 80) return { erro: 'Informe seu nome (até 80 caracteres).' };
              return { valor: limpo };
            }}
            onSubmit={(valor) =>
              salvarNome.mutate(
                { nome: valor },
                {
                  onSuccess: () => {
                    toast.success('Nome salvo!');
                    fechar();
                  },
                  onError: () => toast.error('Não foi possível salvar o nome. Tente de novo.'),
                },
              )
            }
          />
        )}
      </Modal>

      <Modal isOpen={editando === 'dia'} onClose={fechar} title="Dia do salário">
        {editando === 'dia' && principal && (
          <FormularioCampo
            id="config-dia-salario"
            label="Dia do recebimento"
            tipo="number"
            inicial={principal.dia_recebimento?.toString() ?? ''}
            ajuda={`Renda: ${principal.descricao}`}
            isLoading={atualizarRenda.isPending}
            onCancel={fechar}
            validar={(v) => {
              const dia = Number(v.trim());
              if (!v.trim() || !Number.isInteger(dia) || dia < 1 || dia > 31) return { erro: 'O dia do salário vai de 1 a 31.' };
              return { valor: dia };
            }}
            onSubmit={(dia) =>
              atualizarRenda.mutate(
                { id: principal.id, data: { dia_recebimento: dia } },
                {
                  onSuccess: () => {
                    toast.success('Dia do salário salvo!');
                    fechar();
                  },
                  onError: () => toast.error('Não foi possível salvar o dia. Tente de novo.'),
                },
              )
            }
          />
        )}
      </Modal>
    </Secao>
  );
}

interface FormularioCampoProps<T> {
  id: string;
  label: string;
  inicial: string;
  tipo?: 'text' | 'number';
  ajuda?: string;
  isLoading: boolean;
  validar: (valor: string) => { erro: string } | { valor: T };
  onCancel: () => void;
  onSubmit: (valor: T) => void;
}

function FormularioCampo<T>({ id, label, inicial, tipo = 'text', ajuda, isLoading, validar, onCancel, onSubmit }: FormularioCampoProps<T>) {
  const [valor, setValor] = useState(inicial);
  const [erro, setErro] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = validar(valor);
    if ('erro' in r) return setErro(r.erro);
    setErro(undefined);
    onSubmit(r.valor);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        id={id}
        label={label}
        type={tipo}
        inputMode={tipo === 'number' ? 'numeric' : undefined}
        min={tipo === 'number' ? 1 : undefined}
        max={tipo === 'number' ? 31 : undefined}
        maxLength={tipo === 'text' ? 80 : undefined}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        required
      />
      {ajuda && <p className="text-xs text-muted">{ajuda}</p>}
      {erro && (
        <p role="alert" className="text-sm text-red">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="min-h-11">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading} className="min-h-11">
          Salvar
        </Button>
      </div>
    </form>
  );
}

// --- Zona de perigo: igual à de antes do A2 (decisão 3), nos dois modos ---

function ZonaDePerigo() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteAccount = async () => {
    if (confirmText !== 'EXCLUIR') return;
    setDeleting(true);
    setError('');

    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir conta');
      }
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setDeleting(false);
    }
  };

  return (
    <section data-secao="perigo" className="rounded-card border border-red/30 bg-red/[0.05] p-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red">
        <AlertTriangle size={16} />
        Zona de perigo
      </h2>
      <p className="mb-4 text-xs text-muted">
        A exclusao da conta remove permanentemente todos os seus dados (treinos,
        habitos, compromissos, financas, notas). Esta acao nao pode ser desfeita.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red/30 px-4 py-2 text-sm font-medium text-red transition-colors hover:bg-red/10"
        >
          <Trash2 size={14} />
          Excluir minha conta
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text">
            Digite <strong className="text-red">EXCLUIR</strong> para confirmar:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-red focus:outline-none"
            disabled={deleting}
          />
          {error && <p className="text-xs text-red">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'EXCLUIR' || deleting}
              className="flex items-center gap-2 rounded-lg bg-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red/80 disabled:opacity-40"
            >
              {deleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Confirmar exclusao
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
                setError('');
              }}
              className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:text-text"
              disabled={deleting}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
