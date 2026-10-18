import { Button, SkeletonCard, SkeletonList } from '../../ui';
import { AlertaContas } from './AlertaContas';
import { AvisoLembretes, type AvisoLembretesProps } from './AvisoLembretes';
import { BoasVindasFinancas, type BoasVindasFinancasProps } from './BoasVindasFinancas';
import { EntradasSaidas } from './EntradasSaidas';
import { HeroSobra } from './HeroSobra';
import { IndicadoresMes } from './IndicadoresMes';
import type { SecoesHome } from './montarHome';
import { OrcamentoResumo } from './OrcamentoResumo';
import { ProximasContas, type ContaProxima } from './ProximasContas';
import { RendaSheet, type RendaSheetProps } from './RendaSheet';
import { UltimosLancamentos, type UltimosLancamentosProps } from './UltimosLancamentos';
import { CardSaldoHoje, type CardSaldoHojeProps } from './CardSaldoHoje';
import { CardSeteDias, CardSobraMes } from './CardPrevisao';
import { CardRendaAReceber, type RendaAReceberItem } from './CardRendaAReceber';
import { GraficoCategorias } from './GraficoCategorias';
import { GraficoEvolucao } from './GraficoEvolucao';
import { RecebiSheet, type RecebiSheetProps } from './RecebiSheet';
import type { EmSeteDias, FatiaCategoria, PontoEvolucao, SobraDoMes } from '@meudia/shared';

/** Cards do dashboard (saldo, previsões, Recebi e gráficos). `null` = painel indisponível: só o resumo do mês. */
export interface DashboardHome {
  saldo: Omit<CardSaldoHojeProps, 'escondido' | 'onAlternarOlho'>;
  /** `null` fora do mês corrente ou sem carteira (previsão sem saldo de partida engana). */
  seteDias: EmSeteDias | null;
  sobraMes: SobraDoMes | null;
  rendasAReceber: RendaAReceberItem[];
  fatias: FatiaCategoria[];
  evolucao: PontoEvolucao[];
  escondido: boolean;
  onAlternarOlho: () => void;
  onRecebi: (renda: RendaAReceberItem) => void;
  recebiSheet: RecebiSheetProps;
}

export interface FinancasHomeViewProps {
  estado: 'carregando' | 'erro' | 'pronto';
  onTentarDeNovo?: () => void;
  /** Obrigatório em `pronto`. */
  secoes: SecoesHome | null;
  hojeISO: string;
  /** `null` quando renda e contas já existem (onboarding concluído). */
  boasVindas: BoasVindasFinancasProps | null;
  /** `null` quando o aviso não se aplica (sem contas, lembretes ativos/indisponíveis ou dispensado). */
  avisoLembretes: AvisoLembretesProps | null;
  rendaSheet: RendaSheetProps;
  contaOcupada?: string;
  pagamentoBloqueado?: boolean;
  erroPainel?: string;
  onPagar: (conta: ContaProxima) => void;
  lancamentos: Omit<UltimosLancamentosProps, 'transacoes'>;
  dashboard?: DashboardHome | null;
}

/**
 * Home de Finanças (pura), ordem do BRIEF: Você tem hoje → previsões → Recebi → contas a vencer → rosca →
 * evolução → sobra/entrou/saiu → limites → indicadores → lançamentos.
 */
export function FinancasHomeView({
  estado,
  onTentarDeNovo,
  secoes,
  hojeISO,
  boasVindas,
  avisoLembretes,
  rendaSheet,
  contaOcupada,
  pagamentoBloqueado,
  erroPainel,
  onPagar,
  lancamentos,
  dashboard = null,
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
  const d = dashboard;
  // Usuária nova sem banco: só o convite "Você tem hoje" (sem cards vazios nem "R$ 0,00").
  const soConvite = !!d && vazio && d.saldo.carteiras.length === 0;

  return (
    <div className="space-y-5">
      {erroPainel && <p role="alert" className="rounded-card border border-border bg-card p-4 text-sm text-muted">{erroPainel}</p>}
      {secoes.alerta && <AlertaContas {...secoes.alerta} hojeISO={hojeISO} />}

      {avisoLembretes && <AvisoLembretes {...avisoLembretes} />}

      {boasVindas && <BoasVindasFinancas {...boasVindas} />}

      {d && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CardSaldoHoje {...d.saldo} escondido={d.escondido} onAlternarOlho={d.onAlternarOlho} />
          {!soConvite && (
            <>
              {d.seteDias && d.sobraMes && (
                <div className="grid grid-cols-1 gap-4">
                  <CardSeteDias seteDias={d.seteDias} escondido={d.escondido} />
                  <CardSobraMes sobra={d.sobraMes} escondido={d.escondido} />
                </div>
              )}
              {d.rendasAReceber.length > 0 && (
                <div className="sm:col-span-2">
                  <CardRendaAReceber rendas={d.rendasAReceber} hojeISO={hojeISO} onRecebi={d.onRecebi} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {secoes.proximasContas && (
        <ProximasContas pagamentoBloqueado={pagamentoBloqueado} {...secoes.proximasContas} hojeISO={hojeISO} contaOcupada={contaOcupada} onPagar={onPagar} />
      )}

      {d && !soConvite && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GraficoCategorias fatias={d.fatias} escondido={d.escondido} />
          <GraficoEvolucao pontos={d.evolucao} escondido={d.escondido} />
        </div>
      )}

      {!vazio && (
        <>
          <HeroSobra {...secoes.hero} />
          <EntradasSaidas {...secoes.entradasSaidas} />
        </>
      )}

      {secoes.orcamento && <OrcamentoResumo {...secoes.orcamento} />}

      {!vazio && <IndicadoresMes {...secoes.indicadores} />}

      {(!vazio || lancamentos.carregando || secoes.transacoes.length > 0) && (
        <UltimosLancamentos {...lancamentos} transacoes={secoes.transacoes} />
      )}

      <RendaSheet {...rendaSheet} />
      {d && <RecebiSheet {...d.recebiSheet} />}
    </div>
  );
}
