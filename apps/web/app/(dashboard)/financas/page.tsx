'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { Button } from '../../../components/ui';
import { AgentBannerAuto } from '../../../components/agent';
import { useAppMode } from '../../../components/AppModeProvider';
import { FinancasHomeView } from '../../../components/financas/home/FinancasHomeView';
import { useFinancasHome } from '../../../components/financas/home/useFinancasHome';
import { LancamentoRapidoSheet, type AcaoRapida } from '../../../components/financas/LancamentoRapidoSheet';
import { SeletorMes } from '../../../components/financas/SeletorMes';
import { deslocarCompetencia } from '../../../lib/financas-ui';

/** Aba Início (modo Finanças): resumo do mês que cabe numa tela. */
export default function FinancasPage() {
  const mode = useAppMode();
  const hojeISO = useMemo(() => hojeSP(), []);

  // --- Seletor de mês (competência em SP, igual ao backend) ---
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const mudarMes = useCallback((delta: number) => setCompetencia((c) => deslocarCompetencia(c, delta)), []);

  // "Gastei" abre a folha do lançamento rápido direto no gasto ("Voltar" leva a Entrou dinheiro/Transferir).
  const [folha, setFolha] = useState<AcaoRapida | null>(null);
  const home = useFinancasHome(competencia, hojeISO, () => setFolha('gastei'));

  return (
    <div className="animate-fadeSlide space-y-2.5 md:space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-syne text-2xl font-bold text-text md:text-3xl">{mode === 'financas' ? 'Início' : 'Finanças'}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setFolha('menu')} className="hidden md:inline-flex">
            <Plus size={16} aria-hidden="true" /> Lançar
          </Button>
          <SeletorMes competencia={competencia} onMudar={mudarMes} />
        </div>
      </div>

      <LancamentoRapidoSheet open={folha !== null} inicial={folha ?? 'menu'} onClose={() => setFolha(null)} />

      {/* Agente IA (fala de todos os módulos; fora do modo Finanças) */}
      {mode !== 'financas' && <AgentBannerAuto />}

      <FinancasHomeView {...home} />
    </div>
  );
}
