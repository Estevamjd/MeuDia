'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';
import { totalDia, ultimoPeso, type MetasSaude, type RespostasSaude } from '@meudia/shared';
import {
  hojeLocal,
  usePerfilSaude,
  usePesoRecente,
  useProfile,
  useRegistrarPesoDoDia,
  useSessoesSemana,
  useTreinos,
  useUpdateProfile,
} from '../../../hooks';
import { Cabecalho, LinkAcao, Rotulo, Secao, Subabas, TelaCaderno, VazioCaderno, classeBotaoContorno } from '../../../components/caderno';
import { BarraCalorias, BarraProteina } from '../../../components/saude/Barras';
import { LinhaTempo } from '../../../components/saude/LinhaTempo';
import { OnboardingSaude } from '../../../components/saude/OnboardingSaude';
import { useRefeicoesCaderno } from '../../../components/saude/useRefeicoesCaderno';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { comTempoLimite } from '../../../lib/onboarding';
import { MENSAGEM_ERRO_CADASTRO_SAUDE, paraProfile, perfilVazio, respostasIniciais } from '../../../lib/perfil-saude';
import { recorteHoje } from '../../../lib/refeicoes-dia';

const fmtKg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Saúde · Hoje (tela 01/09): treino de hoje, calorias, proteína, até 4 refeições e o peso. */
export default function SaudeHojePage() {
  const hoje = hojeLocal();
  const { perfil, carregado, salvar } = usePerfilSaude();
  const profileQ = useProfile();
  const pesoQ = usePesoRecente();
  const treinosQ = useTreinos();
  const sessoesQ = useSessoesSemana({ noModoFinancas: true });
  const atualizarPerfil = useUpdateProfile();
  const registrarPeso = useRegistrarPesoDoDia();
  const refeicoes = useRefeicoesCaderno(hoje);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);

  const ultimo = useMemo(() => ultimoPeso(pesoQ.data ?? []), [pesoQ.data]);
  const profile = profileQ.data ?? null;

  const concluirCadastro = async (respostas: RespostasSaude, metas: MetasSaude) => {
    setSalvandoCadastro(true);
    setErroCadastro(null);
    try {
      await comTempoLimite(atualizarPerfil.mutateAsync(paraProfile(respostas, metas)));
      // O peso do cadastro vira o registro de hoje só se ainda não houver um (não corrige o que já existe).
      if (ultimo?.data !== hoje) await comTempoLimite(registrarPeso.mutateAsync({ peso: respostas.pesoKg, data: hoje }));
      salvar({ ...perfilVazio('respondido'), ...(perfil ?? {}), estado: 'respondido', respostas, metas });
      setCadastroAberto(false);
    } catch {
      setErroCadastro(MENSAGEM_ERRO_CADASTRO_SAUDE);
    } finally {
      setSalvandoCadastro(false);
    }
  };

  if (!carregado) {
    return (
      <TelaCaderno>
        <div className="px-5 py-[18px]" aria-busy="true" aria-label="Carregando">
          <SkeletonList count={3} />
        </div>
      </TelaCaderno>
    );
  }

  if (perfil === null || cadastroAberto) {
    return (
      <TelaCaderno>
        <OnboardingSaude
          inicial={{ ...respostasIniciais(profile, ultimo?.peso ?? null), ...(perfil?.respostas ?? {}) }}
          metasAnteriores={perfil?.metas ?? null}
          salvando={salvandoCadastro}
          erro={erroCadastro}
          onConcluir={(r, m) => void concluirCadastro(r, m)}
          onAgoraNao={() => {
            if (!perfil) salvar(perfilVazio('adiado'));
            setCadastroAberto(false);
            setErroCadastro(null);
          }}
        />
      </TelaCaderno>
    );
  }

  const metaKcal = perfil.metas?.kcal ?? profile?.meta_calorias ?? null;
  const dia = totalDia(refeicoes.query.data ?? []);
  const entradas = refeicoes.entradas;
  const feitas = entradas.filter((e) => e.feita).length;
  const dataCabecalho = format(new Date(), "EEE dd MMM", { locale: ptBR }).replace('.', '').toUpperCase();

  // Treino de hoje
  const diaSemana = getDay(new Date());
  const doDia = (treinosQ.data ?? []).filter((t) => t.dia_semana === diaSemana);
  const treino = doDia.find((t) => t.tipo !== 'descanso') ?? null;
  const descanso = !treino ? doDia.find((t) => t.tipo === 'descanso') ?? null : null;
  const totalSeries = (treino?.exercicios ?? []).reduce((s, e) => s + (e.series ?? 0), 0);
  const feitoHoje = !!treino && (sessoesQ.data ?? []).some(
    (s) => s.treino_id === treino.id && s.concluido && (s.data ?? s.created_at ?? '').slice(0, 10) === hoje,
  );

  let blocoTreino;
  if (treinosQ.isLoading) {
    blocoTreino = (
      <Secao rotulo="Treino de hoje">
        <SkeletonList count={1} />
      </Secao>
    );
  } else if (treinosQ.isError) {
    blocoTreino = (
      <EmptyState
        icon={<AlertCircle size={36} aria-hidden="true" />}
        title="Não deu para carregar o treino."
        description="Confira a conexão e tente de novo."
        actionLabel="Tentar de novo"
        onAction={() => void treinosQ.refetch()}
      />
    );
  } else if (treino) {
    blocoTreino = (
      <Secao rotulo="Treino de hoje">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-syne text-[22px] font-bold leading-tight text-text">{treino.nome}</h2>
            <p className="mt-0.5 text-[14.5px] text-muted-text tabular-nums">
              {feitoHoje
                ? `concluído · ${totalSeries} séries`
                : `${treino.exercicios?.length ?? 0} exercícios · ${totalSeries} séries`}
            </p>
          </div>
          {feitoHoje ? (
            <span className="rounded-[2px] border border-accent3/50 px-2 py-0.5 text-[10px] uppercase tracking-[1.4px] text-accent3">feito</span>
          ) : (
            <Link href="/treinos" className={classeBotaoContorno}>
              Começar →
            </Link>
          )}
        </div>
      </Secao>
    );
  } else if (descanso) {
    blocoTreino = (
      <Secao rotulo="Treino de hoje">
        <h2 className="font-syne text-[22px] font-bold leading-tight text-text">{descanso.nome}</h2>
        <p className="mt-0.5 text-[14.5px] text-muted-text">Sem musculação programada.</p>
      </Secao>
    );
  } else {
    blocoTreino = (
      <VazioCaderno
        rotulo="Treino de hoje"
        titulo="Nenhum treino hoje."
        explicacao="Monte o treino do dia na aba Treino."
        acao="Montar treino"
        href="/treinos"
      />
    );
  }

  return (
    <TelaCaderno>
      <Cabecalho titulo="Saúde" contexto={dataCabecalho} />
      <Subabas />

      {blocoTreino}

      <Secao>
        {refeicoes.query.isError ? (
          <p className="text-[14px] text-muted-text">Não deu para carregar as calorias de hoje.</p>
        ) : (
          <BarraCalorias consumido={dia.kcal} meta={metaKcal} itensSemValor={dia.itensSemValor} />
        )}
        <div className="mt-6">
          <BarraProteina consumido={dia.proteina} min={perfil.metas?.proteinaMinG ?? null} max={perfil.metas?.proteinaMaxG ?? null} />
        </div>
        {!perfil.metas && (
          <div className="mt-2">
            <LinkAcao onClick={() => setCadastroAberto(true)}>calcular metas</LinkAcao>
          </div>
        )}
      </Secao>

      <Secao>
        <div className="flex items-center justify-between">
          <Rotulo>
            Refeições · {feitas} de {entradas.length}
          </Rotulo>
          <Link href="/saude/dieta" className="min-h-11 content-center whitespace-nowrap text-[14px] font-bold tracking-normal text-accent3">
            ver todas
          </Link>
        </div>
        {refeicoes.query.isLoading ? (
          <SkeletonList count={2} />
        ) : refeicoes.query.isError ? (
          <EmptyState
            icon={<AlertCircle size={36} aria-hidden="true" />}
            title="Não deu para carregar as refeições."
            description="Confira a conexão e tente de novo."
            actionLabel="Tentar de novo"
            onAction={() => void refeicoes.query.refetch()}
          />
        ) : (
          <LinhaTempo entradas={recorteHoje(entradas)} onPonto={refeicoes.onPonto} ocupado={refeicoes.ocupado} />
        )}
      </Secao>

      {pesoQ.isLoading ? null : ultimo ? (
        <Secao rotulo="Peso">
          <div className="flex items-baseline justify-between gap-3">
            <p>
              <span className="font-syne text-[32px] font-bold leading-none text-text tabular-nums">{fmtKg(ultimo.peso)}</span>
              <span className="ml-1 text-[15px] text-muted-text tabular-nums">
                kg{profile?.meta_peso ? ` · meta ${fmtKg(Number(profile.meta_peso))}` : ''}
              </span>
            </p>
            <Link href="/saude/peso" className="min-h-11 content-center whitespace-nowrap text-[14px] font-bold tracking-normal text-accent3">
              ver gráfico
            </Link>
          </div>
        </Secao>
      ) : (
        <VazioCaderno
          rotulo="Peso"
          titulo="Nenhum peso ainda."
          explicacao="O gráfico aparece depois do primeiro registro."
          acao="Registrar peso de hoje"
          href="/saude/peso"
        />
      )}

      <div className="px-5 py-3">
        <LinkAcao onClick={() => setCadastroAberto(true)}>refazer cadastro de saúde</LinkAcao>
      </div>

      {refeicoes.modais}
    </TelaCaderno>
  );
}
