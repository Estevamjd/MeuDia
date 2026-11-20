import { HandCoins } from 'lucide-react';
import { Button } from '../../ui';
import { diasAte, formatBRL, formatDiaMes } from '../../../lib/financas-ui';

export interface RendaAReceberItem {
  rendaId: string;
  descricao: string;
  valor: number;
  data: string;
  competencia: string;
}

/** "cai hoje", "cai amanhã", "cai em 3 dias", "era para cair em 05/10". */
export function textoRecebimento(dataISO: string, hojeISO: string): string {
  const dias = diasAte(dataISO, hojeISO);
  if (dias === 0) return 'cai hoje';
  if (dias === 1) return 'cai amanhã';
  if (dias > 1) return `cai em ${dias} dias`;
  return `era para cair em ${formatDiaMes(dataISO)}`;
}

/**
 * Linha "A receber: Salário dia 5 · Recebi" dentro de Contas a vencer (R6): o salário só entra pelo toque.
 * Texto quebra em até 2 linhas, sem reticências (QA 390/360px: "A receber: Renda principal dia 5" cortado); o Recebi
 * não encolhe e fica com ≥ 44px.
 */
export function LinhaRendaAReceber({ renda, hojeISO, onRecebi }: { renda: RendaAReceberItem; hojeISO: string; onRecebi: (renda: RendaAReceberItem) => void }) {
  return (
    <li className="flex min-h-[44px] items-center gap-3 py-0.5">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green/[0.14] text-green">
        <HandCoins size={16} />
      </span>
      <div className="min-w-0 flex-1" data-testid="renda-a-receber-texto">
        <p className="break-words text-[15px] font-medium leading-tight text-text">
          A receber: {renda.descricao} dia {Number(renda.data.slice(8, 10))}
        </p>
        <p className="mt-0.5 break-words text-[12px] leading-tight text-muted">
          <span className="whitespace-nowrap tabular-nums">{formatBRL(renda.valor)}</span> · {textoRecebimento(renda.data, hojeISO)}
        </p>
      </div>
      <Button variant="ghost" className="min-h-[44px] min-w-[44px] shrink-0 bg-green/[0.14] text-green" onClick={() => onRecebi(renda)} aria-label={`Recebi ${renda.descricao}`}>
        Recebi
      </Button>
    </li>
  );
}
