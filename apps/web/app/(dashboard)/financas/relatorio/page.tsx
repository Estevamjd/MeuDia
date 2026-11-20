'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { competenciaDe, hojeSP } from '@meudia/shared';
import { Button, SkeletonCard } from '../../../../components/ui';
import { SeletorMes } from '../../../../components/financas/SeletorMes';
import { CabecalhoPagina, primeiroNome } from '../../../../components/financas/resumo/CabecalhoPagina';
import { PainelView } from '../../../../components/financas/painel/PainelView';
import { faixaDosMeses, gastoAcumulado, numerosPainel, separarPorCompetencia, sobraPorMes, ultimosMeses } from '../../../../components/financas/painel/montarPainel';
import { montarResumoMes } from '../../../../components/financas/resumo/montarResumoMes';
import { montarDashboard } from '../../../../components/financas/home/montarDashboard';
import { usePainelSaldo, useTransacoesFaixa } from '../../../../hooks';
import { useProfile } from '../../../../hooks/useProfile';
import { deslocarCompetencia, partesCompetencia } from '../../../../lib/financas-ui';
import { lerEsconderValores } from '../../../../lib/carteiras-ui';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Painel (aba Relatório; v4 aprovado em 19/11/2026): seu dinheiro em gráficos, com dados reais do mês. Uma consulta só
 * cobre os 6 meses (1º dia do mais antigo → último dia do mostrado) e é separada por competência em memória: o mês
 * mostrado alimenta tudo; os 5 anteriores só "Quanto sobrou por mês".
 */
export default function RelatorioPage() {
  const hojeISO = useMemo(() => hojeSP(), []);
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO));
  const mudarMes = useCallback((delta: number) => setCompetencia((c) => deslocarCompetencia(c, delta)), []);
  const { ano, mes } = partesCompetencia(competencia);
  const nomeMes = MESES[mes - 1]!;
  const { data: profile } = useProfile();
  const nome = primeiroNome(profile?.nome);
  const competencias = useMemo(() => ultimosMeses(competencia, 6), [competencia]);
  const faixa = useMemo(() => faixaDosMeses(competencias), [competencias]);
  const transacoes = useTransacoesFaixa(faixa.inicio, faixa.fim);
  const porMes = useMemo(
    () => (transacoes.data ? separarPorCompetencia(transacoes.data, competencias) : null),
    [transacoes.data, competencias],
  );
  const doMes = porMes?.get(competencia);
  const painel = usePainelSaldo(hojeISO);
  const [escondido, setEscondido] = useState(false);
  useEffect(() => setEscondido(lerEsconderValores()), []);

  const painelMes = useMemo(() => {
    if (!doMes) return null;
    const dash = painel.data ? montarDashboard(competencia, hojeISO, painel.data, doMes) : null;
    const resumo = montarResumoMes(competencia, doMes, dash?.sobraMes ?? null);
    const numeros = dash?.sobraMes ? numerosPainel(dash.sobraMes) : null;
    return { resumo, numeros, acumulado: dash ? gastoAcumulado(dash.evolucao, competencia, numeros?.faltaPagar ?? 0) : [] };
  }, [competencia, hojeISO, painel.data, doMes]);
  const resumo = painelMes?.resumo ?? null;

  const meses = useMemo(
    () =>
      sobraPorMes(
        competencias.map((c) => ({ competencia: c, transacoes: porMes?.get(c) })),
        painelMes?.numeros ? { competencia, valor: painelMes.numeros.sobra } : null,
      ),
    [competencias, competencia, painelMes, porMes],
  );

  const pelaApp = resumo ? resumo.quantidade.total - resumo.quantidade.whatsapp : 0;

  return (
    <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-3 md:space-y-4">
      <CabecalhoPagina
        marca={nome ? `Seu ${nomeMes}, ${nome}` : `Seu ${nomeMes}`}
        titulo="Painel"
        contexto={<SeletorMes competencia={competencia} onMudar={mudarMes} discreto />}
        className="mb-2"
      />

      {transacoes.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : transacoes.isError || !resumo ? (
        <div role="alert" className="lap-cartao flex items-center justify-between gap-3 p-4 text-[15px] text-text">
          <span>Não foi possível carregar o painel.</span>
          <Button variant="ghost" onClick={() => void transacoes.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : resumo.vazio ? (
        <section className="lap-cartao flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-trilho text-accent shadow-[0_0_24px_-8px_rgb(var(--c-brilho)/0.6)]">
            <FileText size={22} aria-hidden="true" />
          </span>
          <h2 className="text-base font-medium text-text">Nada em {nomeMes} ainda</h2>
          <p className="max-w-xs text-[13px] leading-snug text-muted">
            Quando você lançar gastos e entradas, o resumo do mês aparece aqui, pronto para receber no WhatsApp.
          </p>
          <Link href="/financas" className="mt-1 text-sm font-medium text-accent">
            Ir para o Início
          </Link>
        </section>
      ) : (
        <>
          <PainelView nomeMes={nomeMes} numeros={painelMes!.numeros} resumo={resumo} acumulado={painelMes!.acumulado} meses={meses} escondido={escondido} />
          <p className="pt-1 text-xs text-muted">
            {resumo.quantidade.total === 1 ? '1 lançamento' : `${resumo.quantidade.total} lançamentos`}
            {' · '}
            {resumo.quantidade.whatsapp} pelo WhatsApp e {pelaApp} pelo app · {nomeMes} de {ano}
          </p>
        </>
      )}
    </div>
  );
}
