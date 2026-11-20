import { CreditCard } from 'lucide-react';
import { rotuloParcela, type Transacao } from '@meudia/shared';

/** Selo "3/10" de uma parcela do cartão (mesmo desenho do selo de origem); compra à vista não mostra nada. */
export function SeloParcela({ t }: { t: Pick<Transacao, 'parcela_num' | 'parcela_total'> }) {
  const rotulo = rotuloParcela(t);
  if (!rotulo) return null;
  return (
    <span className="selo-origem selo-origem-manual" data-testid="selo-parcela" aria-label={`Parcela ${rotulo.replace('/', ' de ')}`}>
      <CreditCard size={10} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
