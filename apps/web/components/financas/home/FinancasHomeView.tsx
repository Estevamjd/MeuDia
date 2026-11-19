import { Button, SkeletonCard, SkeletonList } from '../../ui';
import { BoasVindasFinancas, type BoasVindasFinancasProps } from './BoasVindasFinancas';
import type { SecoesHome } from './montarHome';
import { ProximasContas, type ContaProxima } from './ProximasContas';
import { RendaSheet, type RendaSheetProps } from './RendaSheet';
import { CardSaldoHoje } from './CardSaldoHoje';
import { HeroiSobra } from '../resumo/HeroiSobra';
import { ParaOndeFoi } from '../resumo/ParaOndeFoi';
import { UltimosLancamentos } from '../resumo/UltimosLancamentos';
import type { ResumoMes } from '../resumo/montarResumoMes';
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
  /** Sobra, Entrou/Saiu, categorias e últimos lançamentos do mês (design v2). */
  resumo?: ResumoMes | null;
  escondido?: boolean;
  /** Olho do cabeçalho (esconde os valores); usado pela página. */
  onAlternarOlho?: () => void;
}

/**
 * Início (design v2 Astro G, aprovado em 18/11/2026): Sobra do mês (com Entrou/Saiu) → Contas a vencer (com "A receber")
 * → Para onde foi → Últimos lançamentos com selo Manual/WhatsApp e o "Gastei".
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
  resumo = null,
  escondido = false,
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
    <div className="space-y-3">
      {erroPainel && <p role="alert" className="lap-cartao p-4 text-sm text-muted">{erroPainel}</p>}

      {boasVindas && <BoasVindasFinancas {...boasVindas} />}

      {/* Usuária nova sem banco: só o convite (sem cards vazios nem "R$ 0,00"). */}
      {soConvite && d && <CardSaldoHoje {...d.saldo} escondido={d.escondido} onAlternarOlho={d.onAlternarOlho} compacto />}

      {!soConvite && resumo && <HeroiSobra resumo={resumo} escondido={escondido} sobra={d?.sobraMes ?? null} />}

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

      {!soConvite && resumo && <ParaOndeFoi categorias={resumo.categorias} escondido={escondido} />}
      {!soConvite && <UltimosLancamentos lancamentos={resumo?.ultimos ?? []} escondido={escondido} onGastei={onGastei} />}

      {/* Cofrinho (saldo por banco) segue na Início, depois do resumo do mês; o olho fica no cabeçalho da página. */}
      {!soConvite && d && <CardSaldoHoje {...d.saldo} escondido={escondido} onAlternarOlho={d.onAlternarOlho} compacto semOlho />}

      <RendaSheet {...rendaSheet} />
      {d && <RecebiSheet {...d.recebiSheet} />}
    </div>
  );
}
