'use client';

import { Fragment } from 'react';
import { AlertCircle } from 'lucide-react';
import { TACO_CITACAO_CURTA, totalDia } from '@meudia/shared';
import { hojeLocal, usePerfilSaude, useProfile } from '../../../../hooks';
import { Cabecalho, LinkAcao, Secao, Subabas, TelaCaderno } from '../../../../components/caderno';
import { LinhaTempo } from '../../../../components/saude/LinhaTempo';
import { LembreteIndisponivel } from '../../../../components/saude/LembreteIndisponivel';
import { useRefeicoesCaderno } from '../../../../components/saude/useRefeicoesCaderno';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { SkeletonList } from '../../../../components/ui/Skeleton';
import type { EntradaRefeicao } from '../../../../lib/refeicoes-dia';

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

/**
 * Saúde · Dieta (tela 03): linha do tempo completa do dia. Feita: editar · duplicar · substituir.
 * Pendente: tocar no ponto marca como feita com os itens do modelo; "registrar" abre os itens antes.
 */
export default function SaudeDietaPage() {
  const hoje = hojeLocal();
  const { perfil } = usePerfilSaude();
  const profileQ = useProfile();
  const r = useRefeicoesCaderno(hoje);
  const dia = totalDia(r.query.data ?? []);
  const metaKcal = perfil?.metas?.kcal ?? profileQ.data?.meta_calorias ?? null;

  const acoes = (e: EntradaRefeicao) => {
    const links = e.feita
      ? [
          <LinkAcao key="editar" onClick={() => r.abrirEditor(e, 'editar')} ariaLabel={`Editar ${e.nome.toLowerCase()}`}>editar</LinkAcao>,
          <LinkAcao key="duplicar" onClick={() => r.duplicar(e)} disabled={r.ocupado === e.chave} ariaLabel={`Duplicar ${e.nome.toLowerCase()}`}>duplicar</LinkAcao>,
          <LinkAcao key="substituir" onClick={() => r.abrirEditor(e, 'substituir')} ariaLabel={`Substituir ${e.nome.toLowerCase()}`}>substituir</LinkAcao>,
        ]
      : [<LinkAcao key="registrar" onClick={() => r.abrirEditor(e, 'registrar')} ariaLabel={`Registrar ${e.nome.toLowerCase()}`}>registrar</LinkAcao>];
    return links.map((l, i) => (
      <Fragment key={i}>
        {i > 0 && <span aria-hidden="true" className="text-[14px] font-bold text-accent3">·</span>}
        {l}
      </Fragment>
    ));
  };

  return (
    <TelaCaderno>
      <Cabecalho titulo="Dieta" contexto={metaKcal ? `${fmt(dia.kcal)} / ${fmt(metaKcal)} kcal` : `${fmt(dia.kcal)} kcal`} />
      <Subabas />

      {r.query.isLoading ? (
        <div className="px-5 py-[18px]" aria-busy="true" aria-label="Carregando refeições">
          <SkeletonList count={3} />
        </div>
      ) : r.query.isError ? (
        <EmptyState
          icon={<AlertCircle size={36} aria-hidden="true" />}
          title="Não deu para carregar as refeições."
          description="Confira a conexão e tente de novo."
          actionLabel="Tentar de novo"
          onAction={() => void r.query.refetch()}
        />
      ) : (
        <>
          <section className="border-b border-white/[0.07] px-5 pb-2 pt-1">
            <LinhaTempo entradas={r.entradas} onPonto={r.onPonto} ocupado={r.ocupado} comKcal acoes={acoes} />
          </section>
          <Secao rotulo="Total do dia">
            <p className="text-[15px] text-text tabular-nums">
              <span className="font-syne text-[22px] font-bold">{fmt(dia.kcal)}</span> kcal ·{' '}
              <span className="font-syne text-[22px] font-bold">{fmt(dia.proteina)}</span> g de proteína
            </p>
            {dia.itensSemValor > 0 && (
              <p className="mt-1 text-[13px] text-muted-text">
                {dia.itensSemValor === 1
                  ? 'Total parcial: 1 item sem valor não entra na soma.'
                  : `Total parcial: ${dia.itensSemValor} itens sem valor não entram na soma.`}
              </p>
            )}
          </Secao>
        </>
      )}

      <LembreteIndisponivel id="lembrete-refeicao" titulo="Lembrete de refeição" />

      <p className="px-5 py-4 text-[12.5px] text-muted-text">
        {TACO_CITACAO_CURTA} A tabela ainda não está no app: por enquanto os valores são os que você digita e aparecem como &quot;fora da TACO&quot;.
      </p>

      {r.modais}
    </TelaCaderno>
  );
}
