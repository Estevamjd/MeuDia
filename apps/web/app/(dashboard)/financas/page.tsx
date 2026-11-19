'use client';

import { useState, useMemo, useCallback } from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { Button } from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';
import { useAppMode } from '../../../components/AppModeProvider';
import { FinancasHomeView } from '../../../components/financas/home/FinancasHomeView';
import { useFinancasHome } from '../../../components/financas/home/useFinancasHome';
import { LancamentoRapidoSheet, type AcaoRapida } from '../../../components/financas/LancamentoRapidoSheet';
import { SeletorMes } from '../../../components/financas/SeletorMes';
import { BOTAO_REDONDO, CabecalhoPagina, primeiroNome } from '../../../components/financas/resumo/CabecalhoPagina';
import { useProfile } from '../../../hooks/useProfile';
import { deslocarCompetencia } from '../../../lib/financas-ui';

/** Aba Início (modo Finanças): design v2 Astro G. */
export default function FinancasPage() {
  const mode = useAppMode();
  const hojeISO = useMemo(() => hojeSP(), []);
  const { data: profile } = useProfile();
  const nome = primeiroNome(profile?.nome);

  // --- Seletor de mês (competência em SP, igual ao backend) ---
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const mudarMes = useCallback((delta: number) => setCompetencia((c) => deslocarCompetencia(c, delta)), []);

  // "Gastei" abre a folha do lançamento rápido direto no gasto ("Voltar" leva a Entrou dinheiro/Transferir).
  const [folha, setFolha] = useState<AcaoRapida | null>(null);
  const home = useFinancasHome(competencia, hojeISO, () => setFolha('gastei'));

  return (
    <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-4 md:space-y-5">
      <CabecalhoPagina
        titulo={mode === 'financas' ? (nome ? `Olá, ${nome}` : 'Olá') : 'Finanças'}
        contexto={<SeletorMes competencia={competencia} onMudar={mudarMes} discreto />}
        acoes={
          <>
            <Button onClick={() => setFolha('menu')} className="hidden md:inline-flex">
              <Plus size={16} aria-hidden="true" /> Lançar
            </Button>
            {home.onAlternarOlho && (
              <button
                type="button"
                onClick={home.onAlternarOlho}
                aria-pressed={home.escondido}
                aria-label={home.escondido ? 'Mostrar valores' : 'Esconder valores'}
                className={BOTAO_REDONDO}
              >
                {home.escondido ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            )}
          </>
        }
      />

      <LancamentoRapidoSheet open={folha !== null} inicial={folha ?? 'menu'} onClose={() => setFolha(null)} />

      {/* Agente IA (fala de todos os módulos; fora do modo Finanças) */}
      {mode !== 'financas' && <AgentBannerAuto />}

      <FinancasHomeView {...home} />
    </div>
  );
}
