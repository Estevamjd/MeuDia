import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import type { EstadoPush } from '../../../lib/push';
import { Button } from '../../ui';

export interface BoasVindasFinancasProps {
  rendaCadastrada: boolean;
  contasCadastradas: boolean;
  estadoLembretes: EstadoPush;
  ativandoLembretes?: boolean;
  onAtivarLembretes: () => void;
  onNovoLancamento: () => void;
}

/** Push que não existe neste aparelho/ambiente não vira passo pendente para sempre. */
const LEMBRETES_INDISPONIVEIS: readonly EstadoPush[] = ['nao-suportado', 'nao-configurado'];

function Passo({ feito, titulo, children }: { feito: boolean; titulo: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      {feito ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green" aria-label="Feito" />
      ) : (
        <Circle size={20} className="mt-0.5 shrink-0 text-muted" aria-label="A fazer" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className={feito ? 'text-[15px] text-muted line-through' : 'text-[15px] font-medium text-text'}>{titulo}</p>
        {!feito && children}
      </div>
    </li>
  );
}

/** Estado vazio da home: "Vamos montar seu mês" com passos que viram ✓ quando o dado existe. */
export function BoasVindasFinancas({
  rendaCadastrada,
  contasCadastradas,
  estadoLembretes,
  ativandoLembretes = false,
  onAtivarLembretes,
  onNovoLancamento,
}: BoasVindasFinancasProps) {
  const mostrarLembretes = !LEMBRETES_INDISPONIVEIS.includes(estadoLembretes);
  const passos = mostrarLembretes ? 3 : 2;

  return (
    <section aria-labelledby="boas-vindas-financas" className="space-y-4 rounded-card border border-accent/30 bg-card p-5">
      <div className="space-y-1">
        <h2 id="boas-vindas-financas" className="text-lg font-semibold text-text">
          Vamos montar seu mês
        </h2>
        <p className="text-[15px] text-muted">
          Em {passos} passos você vê quanto sobra{mostrarLembretes ? ' e recebe lembretes das contas' : ''}.
        </p>
      </div>

      <ol className="space-y-3">
        <Passo feito={rendaCadastrada} titulo="Cadastrar sua renda">
          <Link href="/financas/orcamento" className="text-sm font-medium text-accent hover:underline">
            Cadastrar renda
          </Link>
        </Passo>
        <Passo feito={contasCadastradas} titulo="Adicionar suas contas fixas (luz, aluguel, assinaturas)">
          <Link href="/financas/contas?nova=1" className="text-sm font-medium text-accent hover:underline">
            Adicionar conta
          </Link>
        </Passo>
        {mostrarLembretes && (
          <Passo feito={estadoLembretes === 'ativo'} titulo="Ativar lembretes no iPhone">
            {estadoLembretes === 'carregando' && <p className="text-[13px] text-muted">Verificando…</p>}
            {estadoLembretes === 'requer-instalacao' && (
              <p className="text-[13px] text-muted">
                Abra o MeuDia no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”. Depois
                abra pelo ícone e ative aqui.
              </p>
            )}
            {estadoLembretes === 'negado' && (
              <p className="text-[13px] text-muted">
                As notificações estão bloqueadas. No iPhone: Ajustes → Notificações → MeuDia → Permitir Notificações.
              </p>
            )}
            {estadoLembretes === 'inativo' && (
              <Button variant="ghost" className="-ml-4" onClick={onAtivarLembretes} isLoading={ativandoLembretes}>
                Ativar lembretes
              </Button>
            )}
          </Passo>
        )}
      </ol>

      <button type="button" onClick={onNovoLancamento} className="text-sm text-muted underline-offset-2 hover:text-text hover:underline">
        Ou registre um lançamento agora
      </button>
    </section>
  );
}
