'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, MessageCircle, Salad } from 'lucide-react';
import {
  TIPOS_REFEICAO_RAPIDA,
  hojeSP,
  refeicaoPelaHora,
  resumoSemana,
  rotuloRefeicao,
  somarDias,
  type RegistroRefeicao,
  type TipoRefeicaoRapida,
} from '@meudia/shared';
import { useExcluirRegistroRefeicao, useRegistrarRefeicao, useRegistrosRefeicao } from '../../../hooks';
import { Button, ConfirmDialog, Input, SkeletonCard, useToast } from '../../../components/ui';
import { CabecalhoPagina } from '../../../components/financas/resumo/CabecalhoPagina';
import { SemanaPontos } from '../../../components/registros/SemanaPontos';
import { LinhaRegistro } from '../../../components/registros/LinhaRegistro';
import { horaSP, quando } from '../../../components/registros/datas';

const ORDEM: Record<TipoRefeicaoRapida, number> = { cafe: 0, almoco: 1, lanche: 2, jantar: 3, ceia: 4 };

/** Aba Dieta (Fase 2, v1): anotar o que comeu em texto livre, ver hoje e a semana. Calorias e peso ficam em /saude. */
export default function DietaPage() {
  const hojeISO = useMemo(() => hojeSP(), []);
  const ontemISO = somarDias(hojeISO, -1);
  const lista = useRegistrosRefeicao(somarDias(hojeISO, -13));
  const registrar = useRegistrarRefeicao();
  const excluir = useExcluirRegistroRefeicao();
  const toast = useToast();

  const [tipo, setTipo] = useState<TipoRefeicaoRapida>(() => refeicaoPelaHora(horaSP()));
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<RegistroRefeicao | null>(null);

  const registros = useMemo(() => lista.data ?? [], [lista.data]);
  const semana = useMemo(() => resumoSemana(registros, hojeISO), [registros, hojeISO]);
  const deHoje = useMemo(() => registros.filter((r) => r.data === hojeISO).sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo]), [registros, hojeISO]);
  const anteriores = useMemo(() => registros.filter((r) => r.data !== hojeISO).slice(0, 10), [registros, hojeISO]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = descricao.trim();
    if (!texto) return setErro('Diga o que comeu (ex.: arroz, feijão e frango).');
    setErro(null);
    registrar.mutate(
      { tipo, descricao: texto, data: hojeISO },
      {
        onSuccess: () => {
          toast.success(`${rotuloRefeicao(tipo)} registrado`);
          setDescricao('');
        },
        onError: () => toast.error('Não foi possível registrar. Tente de novo.'),
      },
    );
  };

  const linha = (r: RegistroRefeicao, comData: boolean) => (
    <LinhaRegistro
      key={r.id}
      titulo={r.descricao}
      meta={comData ? `${quando(r.data, hojeISO, ontemISO)} · ${rotuloRefeicao(r.tipo)}` : rotuloRefeicao(r.tipo)}
      origem={r.origem}
      onExcluir={() => setExcluindo(r)}
      rotuloExcluir={`Excluir ${rotuloRefeicao(r.tipo).toLowerCase()}: ${r.descricao}`}
    />
  );

  return (
    <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-4 md:space-y-5">
      <CabecalhoPagina titulo="Dieta" contexto="Anote o que comeu, sem contar caloria" />

      {lista.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando refeições">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : lista.isError ? (
        <div role="alert" className="lap-cartao flex items-center justify-between gap-3 p-4 text-[15px] text-text">
          <span>Não foi possível carregar suas refeições.</span>
          <Button variant="ghost" onClick={() => void lista.refetch()}>Tentar de novo</Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="dieta-hoje" className="lap-heroi p-5">
            <h2 id="dieta-hoje" className="lap-rotulo">Hoje</h2>
            <p className="mt-2.5 text-[clamp(2rem,9vw,2.5rem)] font-light leading-[1.1] tracking-[-0.035em] tabular-nums" data-testid="refeicoes-hoje">
              {deHoje.length} {deHoje.length === 1 ? 'refeição' : 'refeições'}
            </p>
            <p className="lap-texto-2 mt-1 text-[13px]">
              {semana.diasAtivos === 0 ? 'Nada anotado esta semana ainda.' : `Anotou em ${semana.diasAtivos} ${semana.diasAtivos === 1 ? 'dia' : 'dias'} desta semana`}
            </p>
            <div className="mt-4">
              <SemanaPontos dias={semana.dias} hoje={semana.hoje} rotuloFeito="anotou" />
            </div>
          </section>

          <section aria-labelledby="dieta-registrar" className="lap-cartao p-4">
            <h2 id="dieta-registrar" className="mb-3 text-[15px] font-medium text-text">Registrar refeição</h2>
            <form onSubmit={enviar} className="space-y-3" noValidate>
              <div role="radiogroup" aria-label="Refeição" className="flex flex-wrap gap-1.5">
                {TIPOS_REFEICAO_RAPIDA.map((t) => (
                  <button
                    key={t.tipo}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t.tipo}
                    onClick={() => setTipo(t.tipo)}
                    className={clsx(
                      'min-h-[40px] rounded-full border px-3 text-[13px] transition-colors',
                      tipo === t.tipo ? 'border-accent/60 bg-accent/15 text-text' : 'border-border bg-card2 text-muted hover:text-text',
                    )}
                  >
                    {t.rotulo}
                  </button>
                ))}
              </div>
              <Input
                id="dieta-descricao"
                label="O que comeu?"
                placeholder="Ex.: arroz, feijão e frango"
                value={descricao}
                maxLength={200}
                onChange={(e) => setDescricao(e.target.value)}
              />
              {erro && <p role="alert" className="text-xs text-red">{erro}</p>}
              <Button type="submit" isLoading={registrar.isPending} className="min-h-[44px] w-full py-3 text-base">
                <Salad size={16} aria-hidden="true" /> Registrar {rotuloRefeicao(tipo).toLowerCase()}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MessageCircle size={12} aria-hidden="true" /> Em breve pelo WhatsApp: “almocei arroz, feijão e frango”.
              </p>
            </form>
          </section>

          <section aria-labelledby="dieta-lista-hoje" className="lap-cartao px-4 pb-1 pt-4">
            <h2 id="dieta-lista-hoje" className="text-[15px] font-medium text-text">O que você comeu hoje</h2>
            {deHoje.length === 0 ? (
              <p className="py-4 text-[13px] text-muted">Nenhuma refeição anotada hoje.</p>
            ) : (
              <ul className="divide-y divide-border">{deHoje.map((r) => linha(r, false))}</ul>
            )}
          </section>

          {anteriores.length > 0 && (
            <section aria-labelledby="dieta-anteriores" className="lap-cartao px-4 pb-1 pt-4">
              <h2 id="dieta-anteriores" className="text-[15px] font-medium text-text">Dias anteriores</h2>
              <ul className="divide-y divide-border">{anteriores.map((r) => linha(r, true))}</ul>
            </section>
          )}

          <Link href="/saude" className="lap-cartao flex min-h-[56px] items-center justify-between gap-3 px-4 text-[15px] text-text">
            <span>
              Calorias e peso
              <span className="block text-xs text-muted">Metas de calorias, proteína e o peso da semana</span>
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden="true" />
          </Link>
        </>
      )}

      <ConfirmDialog
        isOpen={excluindo !== null}
        onClose={() => setExcluindo(null)}
        onConfirm={() =>
          excluindo &&
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              toast.success('Refeição excluída');
              setExcluindo(null);
            },
            onError: () => toast.error('Não foi possível excluir.'),
          })
        }
        title="Excluir refeição?"
        message={excluindo ? `“${excluindo.descricao}” sai da lista.` : ''}
        confirmLabel="Excluir"
        isLoading={excluir.isPending}
      />
    </div>
  );
}
