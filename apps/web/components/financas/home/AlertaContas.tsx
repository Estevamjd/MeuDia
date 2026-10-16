import { AlertTriangle } from 'lucide-react';
import { textoVencimento } from '../../../lib/financas-ui';

export interface ContaAlerta {
  id: string;
  descricao: string;
  vencimento: string;
}

export interface AlertaContasProps {
  /** Contas vencidas ou vencendo hoje, a mais urgente primeiro. */
  contas: ContaAlerta[];
  hojeISO: string;
  /** Âncora/rota de "Ver e marcar como paga". */
  href: string;
}

/** Card de alerta (só existe com conta vencida ou vencendo hoje). */
export function AlertaContas({ contas, hojeISO, href }: AlertaContasProps) {
  const primeira = contas[0];
  if (!primeira) return null;
  const titulo = contas.length === 1 ? '1 conta pede atenção' : `${contas.length} contas pedem atenção`;

  return (
    <section role="alert" className="flex items-start gap-3 rounded-card border border-red/40 bg-red/[0.08] p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-medium text-text">
          {titulo}
          <span className="text-muted"> · {primeira.descricao} {textoVencimento(primeira.vencimento, hojeISO)}</span>
        </p>
        <a href={href} className="text-sm font-medium text-accent hover:underline">
          Ver e marcar como paga
        </a>
      </div>
    </section>
  );
}
