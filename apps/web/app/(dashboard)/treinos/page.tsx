'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Dumbbell, MessageCircle } from 'lucide-react';
import { hojeSP, resumoSemana, somarDias, type RegistroTreino } from '@meudia/shared';
import { useExcluirRegistroTreino, useRegistrarTreino, useRegistrosTreino, useSessoesTreinoDesde, useTreinos } from '../../../hooks';
import { Button, ConfirmDialog, Input, SkeletonCard, useToast } from '../../../components/ui';
import { CabecalhoPagina } from '../../../components/financas/resumo/CabecalhoPagina';
import { SemanaPontos } from '../../../components/registros/SemanaPontos';
import { Sequencia } from '../../../components/registros/Sequencia';
import { LinhaRegistro } from '../../../components/registros/LinhaRegistro';
import { quando } from '../../../components/registros/datas';
import { unirTreinosDoDia } from '../../../lib/treino-dia';

const SUGESTOES = ['Peito', 'Costas', 'Pernas', 'Ombro', 'Braço', 'Cardio', 'Corrida', 'Caminhada'];

/**
 * Aba Treino (Fase 2, v1): registrar em 2 toques, ver a semana e o histórico. O plano por dia fica em /treinos/plano;
 * sessão concluída lá conta aqui no dia dela, sem somar em dobro com o Treino rápido (`unirTreinosDoDia`).
 */
export default function TreinoPage() {
  const hojeISO = useMemo(() => hojeSP(), []);
  const ontemISO = somarDias(hojeISO, -1);
  // 8 semanas bastam para a sequência e o histórico curto (consulta pequena, plano grátis).
  const desde = somarDias(hojeISO, -56);
  const lista = useRegistrosTreino(desde);
  // Sessões do Plano e nomes dos treinos: se falharem, a aba segue só com o Treino rápido.
  const sessoesQ = useSessoesTreinoDesde(desde);
  const treinosQ = useTreinos();
  const registrar = useRegistrarTreino();
  const excluir = useExcluirRegistroTreino();
  const toast = useToast();

  const [descricao, setDescricao] = useState('');
  const [minutos, setMinutos] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<RegistroTreino | null>(null);

  const itens = useMemo(
    () => unirTreinosDoDia(lista.data ?? [], sessoesQ.data ?? [], treinosQ.data ?? []),
    [lista.data, sessoesQ.data, treinosQ.data],
  );
  const semana = useMemo(() => resumoSemana(itens, hojeISO), [itens, hojeISO]);
  const planoHoje = itens.find((i) => i.data === hojeISO && i.tipo === 'plano');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = descricao.trim();
    const min = minutos ? Number(minutos) : null;
    if (!texto) return setErro('Diga o que treinou (ex.: Peito e tríceps).');
    if (min !== null && (!Number.isInteger(min) || min < 1 || min > 600)) return setErro('Minutos entre 1 e 600.');
    setErro(null);
    registrar.mutate(
      { descricao: texto, duracao_min: min, data: hojeISO },
      {
        onSuccess: () => {
          toast.success('Treino registrado');
          setDescricao('');
          setMinutos('');
        },
        onError: () => toast.error('Não foi possível registrar. Tente de novo.'),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl animate-fadeSlide space-y-4 md:space-y-5">
      <CabecalhoPagina titulo="Treino" contexto="O que você fez e como foi a semana" />

      {lista.isLoading || sessoesQ.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando treinos">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : lista.isError ? (
        <div role="alert" className="lap-cartao flex items-center justify-between gap-3 p-4 text-[15px] text-text">
          <span>Não foi possível carregar seus treinos.</span>
          <Button variant="ghost" onClick={() => void lista.refetch()}>Tentar de novo</Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="treino-semana" className="lap-heroi p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 id="treino-semana" className="lap-rotulo">Esta semana</h2>
              <Sequencia semanas={semana.sequenciaSemanas} oQue="treinando" />
            </div>
            <p className="mt-2.5 text-[clamp(2rem,9vw,2.5rem)] font-light leading-[1.1] tracking-[-0.035em] tabular-nums" data-testid="treino-dias-semana">
              {semana.diasAtivos} {semana.diasAtivos === 1 ? 'dia' : 'dias'}
            </p>
            <p className="lap-texto-2 mt-1 text-[13px]">
              {semana.quantidade === 0
                ? 'Nenhum treino ainda. O primeiro conta muito.'
                : `${semana.quantidade} ${semana.quantidade === 1 ? 'treino' : 'treinos'}${semana.minutos ? ` · ${semana.minutos} min` : ''}`}
            </p>
            <div className="mt-4">
              <SemanaPontos dias={semana.dias} hoje={semana.hoje} rotuloFeito="treinou" />
            </div>
          </section>

          <section aria-labelledby="treino-registrar" className="lap-cartao p-4">
            <h2 id="treino-registrar" className="mb-3 text-[15px] font-medium text-text">Registrar treino de hoje</h2>
            {planoHoje && (
              <p className="-mt-1 mb-3 text-[13px] text-muted" data-testid="treino-plano-hoje">
                Hoje você concluiu “{planoHoje.titulo}” no plano. Já conta na semana.
              </p>
            )}
            <form onSubmit={enviar} className="space-y-3" noValidate>
              <Input
                id="treino-descricao"
                label="O que treinou?"
                placeholder="Ex.: Peito e tríceps"
                value={descricao}
                maxLength={120}
                onChange={(e) => setDescricao(e.target.value)}
              />
              <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Sugestões">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDescricao((d) => (d.trim() ? `${d.trim()}, ${s.toLowerCase()}` : s))}
                    className="min-h-[36px] rounded-full border border-border bg-card2 px-3 text-[13px] text-muted transition-colors hover:border-accent/40 hover:text-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Input
                id="treino-minutos"
                label="Quanto tempo? (minutos, opcional)"
                inputMode="numeric"
                placeholder="40"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
              {erro && <p role="alert" className="text-xs text-red">{erro}</p>}
              <Button type="submit" isLoading={registrar.isPending} className="min-h-[44px] w-full py-3 text-base">
                <Dumbbell size={16} aria-hidden="true" /> Registrar treino
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MessageCircle size={12} aria-hidden="true" /> Em breve pelo WhatsApp: “treinei peito 40min”.
              </p>
            </form>
          </section>

          <section aria-labelledby="treino-historico" className="lap-cartao px-4 pb-1 pt-4">
            <h2 id="treino-historico" className="text-[15px] font-medium text-text">Últimos treinos</h2>
            {itens.length === 0 ? (
              <p className="py-4 text-[13px] text-muted">Seus treinos aparecem aqui, com a data e de onde vieram.</p>
            ) : (
              <ul className="divide-y divide-border">
                {itens.slice(0, 10).map((i) => (
                  <LinhaRegistro
                    key={`${i.tipo}:${i.id}`}
                    titulo={i.titulo}
                    meta={`${quando(i.data, hojeISO, ontemISO)}${i.duracao_min ? ` · ${i.duracao_min} min` : ''}`}
                    {...(i.tipo === 'rapido'
                      ? { origem: i.registro.origem, onExcluir: () => setExcluindo(i.registro), rotuloExcluir: `Excluir treino ${i.titulo}` }
                      : { origem: 'plano' as const })}
                  />
                ))}
              </ul>
            )}
          </section>

          <Link href="/treinos/plano" className="lap-cartao flex min-h-[56px] items-center justify-between gap-3 px-4 text-[15px] text-text">
            <span>
              Plano de treino
              <span className="block text-xs text-muted">Exercícios, séries e cargas por dia da semana</span>
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
              toast.success('Treino excluído');
              setExcluindo(null);
            },
            onError: () => toast.error('Não foi possível excluir.'),
          })
        }
        title="Excluir treino?"
        message={excluindo ? `“${excluindo.descricao}” sai do histórico.` : ''}
        confirmLabel="Excluir"
        isLoading={excluir.isPending}
      />
    </div>
  );
}
