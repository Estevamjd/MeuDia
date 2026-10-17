import { HandCoins } from 'lucide-react';
import { Button } from '../../ui';
import { diasAte, formatBRL, formatDiaMes } from '../../../lib/financas-ui';
import { CardDashboard } from './CardDashboard';

export interface RendaAReceberItem {
  rendaId: string;
  descricao: string;
  valor: number;
  data: string;
  competencia: string;
}

export interface CardRendaAReceberProps {
  rendas: RendaAReceberItem[];
  hojeISO: string;
  onRecebi: (renda: RendaAReceberItem) => void;
}

/** "cai hoje", "cai amanhã", "cai em 3 dias", "era para cair em 05/10". */
export function textoRecebimento(dataISO: string, hojeISO: string): string {
  const dias = diasAte(dataISO, hojeISO);
  if (dias === 0) return 'cai hoje';
  if (dias === 1) return 'cai amanhã';
  if (dias > 1) return `cai em ${dias} dias`;
  return `era para cair em ${formatDiaMes(dataISO)}`;
}

/** "Salário a receber · Recebi" (R6): o salário só entra pelo toque. */
export function CardRendaAReceber({ rendas, hojeISO, onRecebi }: CardRendaAReceberProps) {
  return (
    <CardDashboard id="renda-a-receber" titulo="Salário a receber" icone={<HandCoins size={20} />} corIcone="bg-green/[0.14] text-green">
      <ul className="space-y-2">
        {rendas.map((r) => (
          <li key={r.rendaId} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-text">{r.descricao}</p>
              <p className="text-[13px] text-muted">
                {formatBRL(r.valor)} · {textoRecebimento(r.data, hojeISO)}
              </p>
            </div>
            <Button className="min-h-[44px] shrink-0" onClick={() => onRecebi(r)} aria-label={`Recebi ${r.descricao}`}>
              Recebi
            </Button>
          </li>
        ))}
      </ul>
    </CardDashboard>
  );
}
