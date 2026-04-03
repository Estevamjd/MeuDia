'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
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
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="font-syne text-2xl font-bold">Configuracoes</h1>

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

      {/* Zona de perigo */}
      <section className="rounded-card border border-red/30 bg-red/[0.05] p-5">
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
    </div>
  );
}
