import { Button, SkeletonCard, SkeletonList } from '../../ui';
import { BoasVindasFinancas, type BoasVindasFinancasProps } from './BoasVindasFinancas';
import type { SecoesHome } from './montarHome';
import { ProximasContas, type ContaProxima } from './ProximasContas';
import { RendaSheet, type RendaSheetProps } from './RendaSheet';
import { UltimosGastos } from './UltimosGastos';
import { CardSaldoHoje } from './CardSaldoHoje';
import { CardSobraMes } from './CardPrevisao';
import type { RendaAReceberItem } from './CardRendaAReceber';
import type { DadosDashboard } from './montarDashboard';
import { RecebiSheet, type RecebiSheetProps } from './RecebiSheet';

/** Cofrinho, sobra do mês e Recebi (gráficos ficam em Gastos › Análise). `null` = painel indisponível. */
export interface DashboardHome extends DadosDashboard {
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
  rendaSheet: RendaSheetProps;
  contaOcupada?: string;
  pagamentoBloqueado?: boolean;
  erroPainel?: string;
  onPagar: (conta: ContaProxima) => void;
  /** Abre a folha de lançamento já no "Gastei" (Voltar leva a Entrou dinheiro/Transferir). */
  onGastei: () => void;
  dashboard?: DashboardHome | null;
}

/**
 * Início resumida (decisão 7), nesta ordem e só isto: Cofrinho → No fim do mês sobra → Contas a vencer (com "A receber")
 * → 3 últimos gastos. Cabe em 390×844 acima da barra de abas sem rolar (e2e/abas.spec.ts).
 */
export function FinancasHomeView({
  estado,
  onTentarDeNovo,
  secoes,
  hojeISO,
  boasVindas,
  rendaSheet,
  contaOcupada,
  pagamentoBloqueado,
  erroPainel,
  onPagar,
  onGastei,
  dashboard = null,
}: FinancasHomeViewProps) {
  if (estado === 'carregando') {
    return (
      <div className="space-y-3" aria-busy="true">
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

  const d = dashboard;
  // Usuária nova sem banco: só o convite do "Cofrinho" (sem cards vazios nem "R$ 0,00").
  const soConvite = !!d && secoes.vazio && d.saldo.carteiras.length === 0;
  const rendasAReceber = d && !soConvite ? d.rendasAReceber : [];
  const contas = secoes.contasAVencer ?? (rendasAReceber.length ? { contas: [], totalMes: 0 } : null);

  return (
    <div className="space-y-2.5">
      {erroPainel && <p role="alert" className="rounded-card border border-border bg-card p-4 text-sm text-muted">{erroPainel}</p>}

      {boasVindas && <BoasVindasFinancas {...boasVindas} />}

      {d && <CardSaldoHoje {...d.saldo} escondido={d.escondido} onAlternarOlho={d.onAlternarOlho} compacto />}
      {d && !soConvite && d.sobraMes && <CardSobraMes sobra={d.sobraMes} escondido={d.escondido} />}

      {contas && (
        <ProximasContas
          {...contas}
          pagamentoBloqueado={pagamentoBloqueado}
          hojeISO={hojeISO}
          contaOcupada={contaOcupada}
          onPagar={onPagar}
          rendasAReceber={rendasAReceber}
          onRecebi={d?.onRecebi}
        />
      )}

      {/* "Gastei" sempre à mão (o "+" saiu da barra); só a usuária sem banco vê apenas o convite. */}
      {!soConvite && <UltimosGastos gastos={secoes.ultimosGastos} onGastei={onGastei} />}

      <RendaSheet {...rendaSheet} />
      {d && <RecebiSheet {...d.recebiSheet} />}
    </div>
  );
}
