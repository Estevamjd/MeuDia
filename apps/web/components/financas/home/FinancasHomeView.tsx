import { Button, SkeletonCard, SkeletonList } from '../../ui';
import { AlertaContas } from './AlertaContas';
import { BoasVindasFinancas, type BoasVindasFinancasProps } from './BoasVindasFinancas';
import { EntradasSaidas } from './EntradasSaidas';
import { HeroSobra } from './HeroSobra';
import { IndicadoresMes } from './IndicadoresMes';
import type { SecoesHome } from './montarHome';
import { OrcamentoResumo } from './OrcamentoResumo';
import { ProximasContas, type ContaProxima } from './ProximasContas';
import { UltimosLancamentos, type UltimosLancamentosProps } from './UltimosLancamentos';

export interface FinancasHomeViewProps {
  estado: 'carregando' | 'erro' | 'pronto';
  onTentarDeNovo?: () => void;
  /** Obrigatório em `pronto`. */
  secoes: SecoesHome | null;
  hojeISO: string;
  boasVindas: Omit<BoasVindasFinancasProps, 'onNovoLancamento'>;
  contaOcupada?: string;
  onPagar: (conta: ContaProxima) => void;
  lancamentos: Omit<UltimosLancamentosProps, 'transacoes'>;
}

/** Home de Finanças (pura): alerta → herói → entrou/saiu → próximas contas → orçamento → indicadores → lançamentos. */
export function FinancasHomeView({
  estado,
  onTentarDeNovo,
  secoes,
  hojeISO,
  boasVindas,
  contaOcupada,
  onPagar,
  lancamentos,
}: FinancasHomeViewProps) {
  if (estado === 'carregando') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard />
        <SkeletonList count={3} />
      </div>
    );
  }

  if (estado === 'erro' || !secoes) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-4 text-[15px] text-text">
        <span>Não foi possível carregar o resumo do mês.</span>
        {onTentarDeNovo && (
          <Button variant="ghost" onClick={onTentarDeNovo}>
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  const { vazio } = secoes;

  return (
    <div className="space-y-5">
      {secoes.alerta && <AlertaContas {...secoes.alerta} hojeISO={hojeISO} />}

      {vazio ? (
        <BoasVindasFinancas {...boasVindas} onNovoLancamento={lancamentos.onNovo} />
      ) : (
        <>
          <HeroSobra {...secoes.hero} />
          <EntradasSaidas {...secoes.entradasSaidas} />
        </>
      )}

      {secoes.proximasContas && (
        <ProximasContas {...secoes.proximasContas} hojeISO={hojeISO} contaOcupada={contaOcupada} onPagar={onPagar} />
      )}

      {secoes.orcamento && <OrcamentoResumo {...secoes.orcamento} />}

      {!vazio && <IndicadoresMes {...secoes.indicadores} />}

      {(!vazio || lancamentos.carregando || secoes.transacoes.length > 0) && (
        <UltimosLancamentos {...lancamentos} transacoes={secoes.transacoes} />
      )}
    </div>
  );
}
