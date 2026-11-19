'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react';
import type { SobraDoMes } from '@meudia/shared';
import { metaDoCartao, progressoMeta, rotuloMesAno, sugestaoMeta, type MetaParaCartao } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes, nomeMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { IconeMeta } from '../metas/IconeMeta';
import { ResumoMesConta, SITUACAO, pctComprometida } from '../resumo/ResumoMesConta';
import { situacaoDo } from '../resumo/montarResumoMes';
import { BANCOS_PATH, type ChipCarteira } from './CardSaldoHoje';

export const METAS_PATH = '/financas/metas';

export interface MetaDoCartao extends MetaParaCartao {
  icone: string | null;
}

export interface CardResumoDeslizanteProps {
  sobra: SobraDoMes;
  /** Dinheiro guardado (Cofrinho). */
  cofrinho: number;
  /** Bancos ativos com saldo de hoje (página "A conta"). */
  carteiras: Pick<ChipCarteira, 'id' | 'nome' | 'saldo'>[];
  /** Metas da pessoa; sem metas, o cartão fica com 2 páginas. */
  metas?: readonly MetaDoCartao[];
  hojeISO: string;
  escondido?: boolean;
}

interface Pagina {
  id: 'resumo' | 'conta' | 'meta';
  titulo: string;
}

/** Páginas do cartão: a "Meta" só existe se houver meta. */
export function paginasDoCartao(temMeta: boolean): Pagina[] {
  return [
    { id: 'resumo', titulo: 'Resumo' },
    { id: 'conta', titulo: 'A conta' },
    ...(temMeta ? [{ id: 'meta' as const, titulo: 'Meta' }] : []),
  ];
}

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (iso: string) => `${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

/**
 * Início (v4, aprovado em 19/11/2026): cartão deslizante com 2 ou 3 páginas.
 * 1 "Resumo": quanto deve sobrar, barra, a meta em uma linha e o Cofrinho. 2 "A conta": a conta explícita (Você recebe −
 * Contas fixas − Gastos do mês) e os bancos. 3 "Meta" (só com meta): progresso, falta, prazo, ritmo e quanto guardar.
 * Scroll-snap nativo (desliza com o dedo) + botões e setas do teclado (WCAG 2.5.1); o próximo cartão aparece na borda.
 */
export function CardResumoDeslizante({ sobra, cofrinho, carteiras, metas = [], hojeISO, escondido = false }: CardResumoDeslizanteProps) {
  const meta = metaDoCartao(metas);
  const paginas = paginasDoCartao(!!meta);
  const [atual, setAtual] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const trilhoRef = useRef<HTMLDivElement>(null);
  const idTrilho = useId();

  const passo = useCallback(() => {
    const el = trilhoRef.current;
    const s = el?.children;
    if (!el || !s || s.length < 2) return el?.clientWidth || 1;
    return (s[1] as HTMLElement).offsetLeft - (s[0] as HTMLElement).offsetLeft || 1;
  }, []);

  // Página atual pela posição do scroll (dedo, botão ou teclado).
  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setAtual(Math.max(0, Math.min(paginas.length - 1, Math.round(el.scrollLeft / passo())))));
    };
    el.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      el.removeEventListener('scroll', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [paginas.length, passo]);

  // Meta apagada estando na página 3: volta para a última que existe.
  useEffect(() => {
    if (atual > paginas.length - 1) setAtual(paginas.length - 1);
  }, [atual, paginas.length]);

  const irPara = useCallback(
    (i: number) => {
      const el = trilhoRef.current;
      const alvo = Math.max(0, Math.min(paginas.length - 1, i));
      if (!el) return;
      el.scrollTo?.({ left: alvo * passo(), behavior: reduzMovimento() ? 'auto' : 'smooth' });
      setAtual(alvo);
      setAnuncio(`Página ${alvo + 1} de ${paginas.length}: ${paginas[alvo]!.titulo}`);
    },
    [paginas, passo],
  );

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); irPara(atual + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(atual - 1); }
  };

  const total = paginas.length;
  const rotuloSlide = (i: number) => `${i + 1} de ${total}: ${paginas[i]!.titulo}`;

  return (
    <section aria-roledescription="carrossel" aria-label="Resumo do mês" data-testid="cartao-resumo" data-paginas={total}>
      <div
        id={idTrilho}
        ref={trilhoRef}
        tabIndex={0}
        onKeyDown={aoTeclar}
        aria-label="Páginas do resumo do mês. Deslize ou use as setas."
        className="sem-barra -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:mx-0 md:scroll-px-0 md:px-0"
      >
        <Slide rotulo={rotuloSlide(0)} testid="cartao-pagina-resumo">
          <PaginaResumo sobra={sobra} cofrinho={cofrinho} meta={meta} hojeISO={hojeISO} escondido={escondido} />
        </Slide>
        <Slide rotulo={rotuloSlide(1)} testid="cartao-pagina-conta" semMaterial>
          <ResumoMesConta sobra={sobra} escondido={escondido} className="h-full">
            {carteiras.length > 0 && <BancosHoje carteiras={carteiras} cofrinho={cofrinho} escondido={escondido} />}
          </ResumoMesConta>
        </Slide>
        {meta && (
          <Slide rotulo={rotuloSlide(2)} testid="cartao-pagina-meta">
            <PaginaMeta meta={meta} sobraMensal={sobra.valor} hojeISO={hojeISO} escondido={escondido} />
          </Slide>
        )}
      </div>

      <div className="mt-2.5 flex min-h-[44px] items-center justify-between gap-2">
        {atual > 0 ? (
          <BotaoPagina onClick={() => irPara(atual - 1)} controla={idTrilho} fantasma>
            <ChevronLeft size={16} aria-hidden="true" /> {paginas[atual - 1]!.titulo}
          </BotaoPagina>
        ) : (
          <Pontos total={total} atual={atual} />
        )}
        {atual > 0 && <Pontos total={total} atual={atual} />}
        {atual < total - 1 ? (
          <BotaoPagina onClick={() => irPara(atual + 1)} controla={idTrilho}>
            {atual === 0 ? 'Ver a conta' : paginas[atual + 1]!.titulo} <ChevronRight size={16} aria-hidden="true" />
          </BotaoPagina>
        ) : paginas[atual]?.id === 'meta' ? (
          <Link href={METAS_PATH} className={clsx(CLASSE_BOTAO, 'text-accent')}>
            Guardar <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-[88px]" aria-hidden="true" />
        )}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{anuncio}</p>
    </section>
  );
}

const CLASSE_BOTAO =
  'lap-cartao inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

function BotaoPagina({ children, onClick, controla, fantasma = false }: { children: ReactNode; onClick: () => void; controla: string; fantasma?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-controls={controla} className={clsx(CLASSE_BOTAO, fantasma ? 'text-muted' : 'text-accent')}>
      {children}
    </button>
  );
}

function Pontos({ total, atual }: { total: number; atual: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true" data-testid="cartao-pontos">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={clsx('block h-[7px] rounded-full transition-all motion-reduce:transition-none', i === atual ? 'w-5 bg-accent' : 'w-[7px] bg-text/20')} />
      ))}
    </span>
  );
}

function Slide({ children, rotulo, testid, semMaterial = false }: { children: ReactNode; rotulo: string; testid: string; semMaterial?: boolean }) {
  return (
    <div
      role="group"
      aria-roledescription="página"
      aria-label={rotulo}
      data-testid={testid}
      className={clsx('flex w-[calc(100%-2.25rem)] shrink-0 snap-start flex-col md:w-[calc(100%-3rem)]', !semMaterial && 'lap-heroi px-5 pb-[18px] pt-5')}
    >
      {children}
    </div>
  );
}

function PaginaResumo({ sobra, cofrinho, meta, hojeISO, escondido }: { sobra: SobraDoMes; cofrinho: number; meta: MetaDoCartao | null; hojeISO: string; escondido: boolean }) {
  const pct = pctComprometida(sobra);
  const pctBarra = pct === null ? 0 : Math.min(Math.max(pct, 0), 100);
  const situacao = SITUACAO[situacaoDo(pct, sobra.valor) ?? 'no-controle'];
  const mes = nomeMes(sobra.competencia);
  const fimMes = formatDiaMes(fimDoMes(sobra.competencia));
  const valorCofrinho = escondido ? VALOR_OCULTO : formatBRLSinal(cofrinho);
  const progresso = meta ? progressoMeta(meta, hojeISO) : null;
  return (
    <>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="lap-rotulo lap-texto-3 font-normal tracking-[0.08em]">
          <span className="capitalize">{mes}</span> · deve sobrar
        </h2>
        {pct !== null && (
          <span className={clsx('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', situacao.classe)}>
            {situacao.texto}
          </span>
        )}
      </div>
      <p
        data-testid="cartao-sobra-valor"
        className={clsx(
          'mt-4 whitespace-nowrap text-[clamp(2.5rem,13vw,3.25rem)] font-light leading-none tracking-[-0.04em] tabular-nums',
          sobra.valor < 0 && !escondido ? 'text-[var(--lap-h-alerta)]' : 'text-[var(--lap-h-positivo)]',
        )}
      >
        {escondido ? VALOR_OCULTO : <NumeroAnimado valor={sobra.valor} formatar={formatBRLSinal} />}
      </p>
      <p className="lap-texto-2 mt-1.5 text-[14px]">
        {sobra.valor < 0 ? `passou da renda; o mês fecha em ${fimMes}` : `é o que deve sobrar até ${fimMes}`}
      </p>
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-text/10"
        role="progressbar"
        aria-label="Renda do mês com destino"
        aria-valuenow={pctBarra}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={pct === null ? 'sem renda no mês' : `${pct}% da renda já tem destino`}
      >
        <span className="lap-barra-luz block h-full rounded-full" style={{ width: `${pctBarra}%` }} />
      </div>
      <p className="lap-texto-3 mt-2 text-[12.5px]">
        {pct === null ? 'Cadastre sua renda para ver quanto sobra.' : `${pct}% da renda já tem destino (contas fixas e gastos)`}
      </p>

      {meta && progresso && (
        <div className="lap-vidro mt-3 flex items-center gap-2.5 px-3 py-2.5 text-[13px]" data-testid="cartao-meta-mini">
          <IconeMeta icone={meta.icone} className="h-6 w-6 rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5" />
          <span className="lap-texto-2 min-w-0 truncate font-medium text-text">{meta.nome}</span>
          <span className="h-1 min-w-[48px] flex-1 overflow-hidden rounded-full bg-text/15" aria-hidden="true">
            <span className="block h-full rounded-full bg-[var(--lap-h-positivo)]" style={{ width: `${progresso.pct}%` }} />
          </span>
          <span className="tabular-nums">{progresso.pct}%</span>
        </div>
      )}

      <Link
        href={BANCOS_PATH}
        data-testid="linha-cofrinho"
        aria-label={`Cofrinho: ${escondido ? 'valor oculto' : valorCofrinho}. Abrir Bancos para guardar, tirar ou corrigir`}
        className="lap-texto-2 mt-auto flex min-h-[44px] items-center gap-2 border-t border-text/10 pt-3 text-[14px]"
      >
        <PiggyBank size={17} aria-hidden="true" className="shrink-0 text-[var(--lap-h-positivo)]" />
        <span className="flex-1">
          Cofrinho: <span data-testid="linha-cofrinho-valor" className="font-semibold tabular-nums text-text">{valorCofrinho}</span>
        </span>
        <ChevronRight size={17} aria-hidden="true" className="shrink-0" />
      </Link>
    </>
  );
}

function BancosHoje({ carteiras, cofrinho, escondido }: { carteiras: CardResumoDeslizanteProps['carteiras']; cofrinho: number; escondido: boolean }) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  return (
    <div className="mt-3 border-t border-text/10 pt-3" data-testid="cartao-bancos-hoje">
      <p className="lap-rotulo lap-texto-3">Nos bancos hoje</p>
      <ul className="mt-1.5 space-y-1 text-[14px]">
        {carteiras.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span className="lap-texto-2 min-w-0 truncate">{c.nome}</span>
            <span className="whitespace-nowrap font-medium tabular-nums">{v(c.saldo)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2">
          <span className="lap-texto-2">
            Cofrinho <span className="lap-texto-3 text-[12px]">· guardado à parte</span>
          </span>
          <span className="whitespace-nowrap font-medium tabular-nums">{v(cofrinho)}</span>
        </li>
      </ul>
    </div>
  );
}

const RITMO: Record<'a_frente' | 'no_ritmo' | 'atras', { texto: string; classe: string }> = {
  a_frente: { texto: 'à frente do ritmo', classe: 'border-[color-mix(in_oklch,var(--lap-h-positivo)_30%,transparent)] bg-[color-mix(in_oklch,var(--lap-h-positivo)_14%,transparent)] text-[var(--lap-h-positivo)]' },
  no_ritmo: { texto: 'no ritmo', classe: 'border-text/20 bg-text/10 text-text' },
  atras: { texto: 'atrás do ritmo', classe: 'border-yellow/30 bg-yellow/[0.12] text-yellow' },
};

function PaginaMeta({ meta, sobraMensal, hojeISO, escondido }: { meta: MetaDoCartao; sobraMensal: number; hojeISO: string; escondido: boolean }) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const p = progressoMeta(meta, hojeISO);
  const s = sugestaoMeta({ hojeISO, sobraMensal, valorAlvo: meta.valor_alvo, valorGuardado: meta.valor_guardado, dataLimite: meta.data_limite });
  const ritmo = p.ritmo && !p.alcancada ? RITMO[p.ritmo] : null;
  const meses = s.mesesAtePrazo;
  let guardar: { valor: string; nota: string };
  if (p.alcancada) guardar = { valor: '—', nota: 'meta alcançada' };
  else if (s.porMes !== null) guardar = { valor: v(s.porMes), nota: s.tipo === 'cabe' ? 'cabe na sobra' : 'mais que a sobra do mês' };
  else if (s.metadeDaSobra) guardar = { valor: v(s.metadeDaSobra.porMes), nota: `metade da sobra · ${rotuloMesAno(s.metadeDaSobra.competencia)}` };
  else if (s.sobraInteira) guardar = { valor: v(s.sobraInteira.porMes), nota: 'a sobra do mês' };
  else guardar = { valor: '—', nota: 'sem sobra este mês' };

  return (
    <>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="lap-rotulo lap-texto-3 flex min-w-0 items-center gap-1.5 font-normal tracking-[0.08em]">
          <IconeMeta icone={meta.icone} className="h-[22px] w-[22px] rounded-md [&>svg]:h-3 [&>svg]:w-3" />
          <span className="truncate">Meta · {meta.nome}</span>
        </h2>
        {p.alcancada ? (
          <span className={clsx('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', RITMO.a_frente.classe)}>alcançada 🎉</span>
        ) : ritmo ? (
          <span data-testid="cartao-meta-ritmo" className={clsx('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', ritmo.classe)}>{ritmo.texto}</span>
        ) : null}
      </div>
      <p data-testid="cartao-meta-pct" className="mt-4 text-[52px] font-light leading-none tracking-[-0.04em] tabular-nums">
        {p.pct}
        <span className="ml-0.5 text-2xl text-[var(--lap-h-positivo)]">%</span>
      </p>
      <p className="lap-texto-2 mt-1.5 text-[14px]" data-testid="cartao-meta-valores">
        {v(meta.valor_guardado)} guardados de {v(meta.valor_alvo)}
      </p>
      <div className="lap-texto-3 mt-4 flex items-baseline justify-between gap-2 text-[12.5px]">
        <span data-testid="cartao-meta-falta">
          {p.alcancada ? 'Nada faltando' : <>Faltam <b className="font-medium text-text">{v(p.falta)}</b></>}
        </span>
        {meta.data_limite && <span>prazo {formatDiaMes(meta.data_limite)}/{meta.data_limite.slice(0, 4)}</span>}
      </div>
      <div
        className="relative mb-6 mt-2.5 h-2 rounded-full bg-text/15"
        role="progressbar"
        aria-label={`Meta ${meta.nome}`}
        aria-valuenow={p.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${p.pct}% guardado${p.pctEsperado !== null ? `; pelo ritmo, hoje seria ${p.pctEsperado}%` : ''}`}
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[color-mix(in_oklch,var(--lap-h-positivo)_55%,transparent)] to-[var(--lap-h-positivo)]" style={{ width: `${p.pct}%` }} />
        {p.pctEsperado !== null && !p.alcancada && (
          <span className="absolute -bottom-[5px] -top-[5px] w-0.5 -translate-x-1/2 rounded bg-text/55" style={{ left: `${p.pctEsperado}%` }} data-testid="cartao-meta-hoje">
            <em
              className={clsx(
                'lap-rotulo lap-texto-3 absolute top-4 whitespace-nowrap not-italic text-[9.5px]',
                // Perto das pontas o rótulo encosta para dentro da barra, sem cortar ("hoje 0%", "hoje 100%").
                p.pctEsperado < 12 ? 'left-0' : p.pctEsperado > 88 ? 'right-0' : 'left-1/2 -translate-x-1/2',
              )}
            >
              hoje {p.pctEsperado}%
            </em>
          </span>
        )}
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgb(var(--c-brilho)/0.25),0_0_14px_rgb(var(--c-brilho)/0.8)]"
          style={{ left: `${p.pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="lap-vidro px-3 py-2.5">
          <p className="lap-rotulo lap-texto-3 text-[10px]">Prazo</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums">{meta.data_limite ? mesCurto(meta.data_limite) : 'Sem prazo'}</p>
          <p className="lap-texto-3 text-[11.5px]">
            {meta.data_limite && meses !== null && p.diasAtePrazo !== null
              ? p.diasAtePrazo < 0 ? 'o prazo passou' : `${meses <= 0 ? 'este mês' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`} · ${p.diasAtePrazo} ${p.diasAtePrazo === 1 ? 'dia' : 'dias'}`
              : 'quando der'}
          </p>
        </div>
        <div className="lap-vidro px-3 py-2.5" data-testid="cartao-meta-guardar">
          <p className="lap-rotulo lap-texto-3 text-[10px]">Guardar por mês</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums">{guardar.valor}</p>
          <p className="lap-texto-3 text-[11.5px] leading-snug">{guardar.nota}</p>
        </div>
      </div>
    </>
  );
}

function fimDoMes(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${competencia}-${String(dia).padStart(2, '0')}`;
}
