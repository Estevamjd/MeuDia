'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { clsx } from 'clsx';
import { Skeleton } from '../../ui';
import { formatBRL, formatBRLSinal, formatPct } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { SITUACAO } from '../resumo/ResumoMesConta';
import type { ResumoMes } from '../resumo/montarResumoMes';
import type { NumerosPainel, PontoAcumulado, SobraMes } from './montarPainel';
import { fatiasComCor } from './montarPainel';

const RoscaCategoriasChart = dynamic(() => import('../home/RoscaCategoriasChart'), { ssr: false, loading: () => <Skeleton className="h-32 w-32 shrink-0 rounded-full" /> });
const GastoAcumuladoChart = dynamic(() => import('./GastoAcumuladoChart'), { ssr: false, loading: () => <Skeleton className="h-44 w-full" /> });
const SobraMesesChart = dynamic(() => import('./SobraMesesChart'), { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> });

/** Mesmas cores do gráfico de pilha e da legenda. */
export const COR_FIXAS = '#3987e5';
export const COR_EXTRAS = '#d95926';
export const COR_SOBRA = '#199e70';

export interface PainelViewProps {
  nomeMes: string;
  /** Mês corrente com a conta da sobra; `null` em outro mês (usa o resumo pelos lançamentos). */
  numeros: NumerosPainel | null;
  resumo: ResumoMes;
  acumulado: PontoAcumulado[];
  meses: SobraMes[];
  escondido: boolean;
}

/**
 * Painel (antigo Relatório; v4 aprovado em 19/11/2026): o bloco principal com "Deve sobrar" e três números, depois os
 * gráficos coloridos, cada um com uma frase dizendo como ler.
 */
export function PainelView({ nomeMes, numeros: n, resumo, acumulado, meses, escondido }: PainelViewProps) {
  const v = (x: number) => (escondido ? VALOR_OCULTO : formatBRL(x));
  const valorHeroi = n ? n.sobra : resumo.sobra;
  const situacao = resumo.situacao ? SITUACAO[resumo.situacao] : null;
  const fatias = fatiasComCor(resumo.categorias);
  const totalCategorias = fatias.reduce((s, f) => s + f.valor, 0);
  const temGasto = acumulado.some((p) => (p.gasto ?? 0) > 0);

  return (
    <div className="space-y-3" data-testid="painel">
      <section className="lap-heroi px-5 pb-[18px] pt-5" aria-labelledby="painel-heroi" data-testid="painel-heroi">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <h2 id="painel-heroi" className="lap-rotulo lap-texto-3 font-normal tracking-[0.08em]">
            <span className="capitalize">{nomeMes}</span> · {n ? 'deve sobrar' : 'sobrou'}
          </h2>
          {situacao && (
            <span data-testid="pilula-situacao" data-situacao={resumo.situacao ?? undefined} className={clsx('pilula-situacao inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', situacao.classe)}>{situacao.texto}</span>
          )}
        </div>
        <p
          data-testid="painel-sobra-valor"
          className={clsx(
            'mt-4 whitespace-nowrap text-[clamp(2.25rem,12vw,3rem)] font-light leading-none tracking-[-0.04em] tabular-nums',
            valorHeroi < 0 && !escondido ? 'text-[var(--lap-h-alerta)]' : 'text-[var(--lap-h-positivo)]',
          )}
        >
          {escondido ? VALOR_OCULTO : <NumeroAnimado valor={valorHeroi} formatar={formatBRLSinal} />}
        </p>
        <p className="lap-texto-2 mt-1.5 text-[14px]">{n ? 'se nada mais sair até o fim do mês' : 'o que entrou menos o que saiu no mês'}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Celula {...celulaRenda(n, resumo.entrou, v)} testid="painel-recebeu" />
          <Celula rotulo="Já gastou" valor={v(n ? n.jaGastou : resumo.saiu)} nota={n ? 'pagas + extras' : 'saídas'} testid="painel-ja-gastou" />
          {n ? (
            <Celula rotulo="A pagar" valor={v(n.faltaPagar)} nota={n.contasAPagar === 1 ? '1 conta' : `${n.contasAPagar} contas`} testid="painel-falta-pagar" />
          ) : (
            <Celula rotulo="Lançamentos" valor={String(resumo.quantidade.total)} nota={`${resumo.quantidade.whatsapp} pelo WhatsApp`} testid="painel-lancamentos" />
          )}
        </div>
      </section>

      {n?.partes && (
        <Cartao titulo="Para onde vai o salário" testid="painel-salario"
          explicacao={`Dos ${v(n.recebeu)} do mês: quanto já tem destino certo (contas fixas), quanto foi em gastos do dia a dia (extras) e quanto deve sobrar.`}>
          <div className="my-2.5 flex h-3.5 overflow-hidden rounded-full bg-trilho" role="img"
            aria-label={`Contas fixas ${n.partes.fixas}%, gastos extras ${n.partes.extras}%, deve sobrar ${n.partes.sobra}%`}>
            <span style={{ width: `${n.partes.fixas}%`, background: COR_FIXAS }} />
            <span style={{ width: `${n.partes.extras}%`, background: COR_EXTRAS }} />
            <span style={{ width: `${n.partes.sobra}%`, background: COR_SOBRA }} />
          </div>
          <Legenda itens={[
            { cor: COR_FIXAS, nome: 'Contas fixas', valor: v(n.fixas), pct: n.partes.fixas },
            { cor: COR_EXTRAS, nome: 'Gastos extras', valor: v(n.extras), pct: n.partes.extras },
            { cor: COR_SOBRA, nome: 'Deve sobrar', valor: v(n.sobra), pct: n.partes.sobra },
          ]} />
        </Cartao>
      )}

      {fatias.length > 0 && (
        <Cartao titulo="Para onde foi seu dinheiro" testid="painel-categorias"
          explicacao={`Tudo o que saiu em ${nomeMes}, separado por categoria. Cada cor é uma categoria: quanto maior a fatia, mais dinheiro foi para ela.`}>
          <div className="flex items-center gap-4">
            {!escondido && <RoscaCategoriasChart fatias={fatias} total={totalCategorias} className="h-32 w-32" />}
            <Legenda itens={fatias.map((f) => ({ cor: f.cor, nome: f.categoria, valor: v(f.valor), pct: Math.round(totalCategorias ? (f.valor / totalCategorias) * 100 : 0) }))} />
          </div>
        </Cartao>
      )}

      {temGasto && (
        <Cartao titulo="Seu mês dia a dia" testid="painel-dia-a-dia"
          explicacao={`A área azul é o total que você já gastou até cada dia.${n && n.recebeu > 0 ? ' A linha verde tracejada é a sua renda: enquanto o azul ficar abaixo dela, sobra dinheiro.' : ''}`}>
          {!escondido && <GastoAcumuladoChart pontos={acumulado} renda={n?.recebeu ?? 0} />}
          {n && n.faltaPagar > 0 && <p className="mt-1.5 text-[12px] text-muted">Pontilhado depois de hoje: o que ainda vai sair com as contas a pagar.</p>}
        </Cartao>
      )}

      {meses.length >= 2 && (
        <Cartao titulo="Quanto sobrou por mês" testid="painel-meses"
          explicacao={`Cada barra é o que sobrou no fim de um mês.${meses.some((m) => m.previsao) ? ' O mês atual está mais claro porque ainda é previsão.' : ''}`}>
          {!escondido && <SobraMesesChart meses={meses} />}
        </Cartao>
      )}
    </div>
  );
}

/**
 * Renda nunca aparece como "Recebeu" se ainda não entrou: sem nenhum "Recebi" é "Renda do mês" (previsão); com parte
 * recebida, "Recebeu" mostra só o que entrou e a nota diz quanto falta.
 */
export function celulaRenda(n: NumerosPainel | null, entrou: number, v: (x: number) => string): { rotulo: string; valor: string; nota: string } {
  if (!n) return { rotulo: 'Recebeu', valor: v(entrou), nota: 'entradas' };
  if (!n.previsao) return { rotulo: 'Recebeu', valor: v(n.recebeu), nota: 'renda do mês' };
  if (n.recebido > 0) return { rotulo: 'Recebeu', valor: v(n.recebido), nota: `falta ${v(n.faltaReceber)}` };
  return { rotulo: 'Renda do mês', valor: v(n.recebeu), nota: 'previsão' };
}

function Celula({ rotulo, valor, nota, testid }: { rotulo: string; valor: string; nota: string; testid: string }) {
  return (
    <div className="lap-vidro min-w-0 px-2.5 py-2">
      <p className="lap-rotulo lap-texto-3 truncate text-[10px]">{rotulo}</p>
      <p data-testid={testid} className="mt-0.5 break-words text-[13px] font-medium leading-tight tracking-[-0.02em] tabular-nums">{valor}</p>
      <p className="lap-texto-3 truncate text-[11px]">{nota}</p>
    </div>
  );
}

function Cartao({ titulo, explicacao, testid, children }: { titulo: string; explicacao: string; testid: string; children: ReactNode }) {
  return (
    <section className="lap-cartao p-4" aria-label={titulo} data-testid={testid}>
      <h2 className="text-base font-medium tracking-[-0.02em] text-text">{titulo}</h2>
      <p className="mb-3 mt-1 text-[12.5px] leading-[18px] text-muted">{explicacao}</p>
      {children}
    </section>
  );
}

function Legenda({ itens }: { itens: { cor: string; nome: string; valor: string; pct: number }[] }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.cor }} />
          <span className="min-w-0 flex-1 truncate text-text">{i.nome}</span>
          <span className="whitespace-nowrap font-medium tabular-nums text-text">{i.valor}</span>
          <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-muted">{formatPct(i.pct / 100)}</span>
        </li>
      ))}
    </ul>
  );
}
