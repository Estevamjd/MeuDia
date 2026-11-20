'use client';

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react';
import type { SobraDoMes } from '@meudia/shared';
import { metaDoCartao, progressoMeta, sugestaoMeta, type MetaParaCartao } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes, nomeMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { IconeMeta } from '../metas/IconeMeta';
import { SITUACAO, pctComprometida } from '../resumo/ResumoMesConta';
import { situacaoDo } from '../resumo/montarResumoMes';
import { BANCOS_PATH } from './CardSaldoHoje';
import { cssDoMaco, macoNaRolagem, poseDoCartao, transformDaPose } from './poseDoMaco';

export const METAS_PATH = '/financas/metas';

export interface MetaDoCartao extends MetaParaCartao {
  icone: string | null;
}

export interface CardResumoDeslizanteProps {
  sobra: SobraDoMes;
  /** Dinheiro guardado (Cofrinho). */
  cofrinho: number;
  /** Metas da pessoa; sem metas, o maço fica com 2 cartões. */
  metas?: readonly MetaDoCartao[];
  hojeISO: string;
  escondido?: boolean;
}

interface Pagina {
  id: 'resumo' | 'conta' | 'meta';
  titulo: string;
}

/** Cartões do maço: o "Meta" só existe se houver meta. */
export function paginasDoCartao(temMeta: boolean): Pagina[] {
  return [
    { id: 'resumo', titulo: 'Resumo' },
    { id: 'conta', titulo: 'A conta' },
    ...(temMeta ? [{ id: 'meta' as const, titulo: 'Meta' }] : []),
  ];
}

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (iso: string) => `${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const PILULA = 'inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium';

/**
 * Início v5 (aprovado em 19/11/2026): cartõezinhos no formato de cartão de crédito, em maço, que a pessoa segura e
 * passa para o lado. 1 "Resumo" (deve sobrar, Cofrinho, meta), 2 "A conta" (recebe − contas fixas − gastos), 3 "Meta"
 * (só com meta). Por baixo, um trilho invisível com scroll-snap nativo cuida do dedo, da inércia e do teclado; por cima,
 * os cartões ganham a pose do maço a cada quadro (poseDoMaco). Botões ‹ ›, pontos e anúncio (WCAG 2.5.1); com
 * "reduzir movimento" vira um carrossel simples, sem giro.
 */
export function CardResumoDeslizante({ sobra, cofrinho, metas = [], hojeISO, escondido = false }: CardResumoDeslizanteProps) {
  const meta = useMemo(() => metaDoCartao(metas), [metas]);
  const temMeta = !!meta;
  const paginas = useMemo(() => paginasDoCartao(temMeta), [temMeta]);
  const total = paginas.length;
  const [atual, setAtual] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [contasAbertas, setContasAbertas] = useState(false);
  const secaoRef = useRef<HTMLElement>(null);
  const trilhoRef = useRef<HTMLDivElement>(null);
  /** Última pose escrita em cada cartão (só escreve no DOM o que mudou). */
  const escritoRef = useRef<{ t: string; z: string; v: string }[]>([]);
  /** O navegador anima o maço pela rolagem (compositor); aí o JS não escreve pose por quadro. */
  const naRolagemRef = useRef(false);
  const cartoesRef = useRef<(HTMLDivElement | null)[]>([]);
  const atualRef = useRef(0);
  const idTrilho = useId();
  const idListaContas = useId();
  const mes = nomeMes(sobra.competencia);

  // Página em que o trilho assentou (só re-renderiza ao trocar de cartão, nunca por quadro).
  const assentar = useCallback(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const novo = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / (el.clientWidth || 1))));
    if (novo !== atualRef.current) {
      atualRef.current = novo;
      setAtual(novo);
      setAnuncio(`Cartão ${novo + 1} de ${total}: ${paginas[novo]!.titulo}`);
    }
  }, [paginas, total]);

  // Caminho em JS (sem scroll-driven animations ou com "reduzir movimento"): pose a cada quadro, escrevendo direto
  // no DOM só transform/z-index/visibility que mudaram (nada de layout nem re-render).
  const aplicarPoses = useCallback(() => {
    const el = trilhoRef.current;
    if (!el || naRolagemRef.current) return;
    const largura = el.clientWidth || 1;
    const p = el.scrollLeft / largura;
    const reduzir = reduzMovimento();
    cartoesRef.current.forEach((c, i) => {
      if (!c) return;
      const pose = poseDoCartao(i - p, largura, reduzir);
      const ant = (escritoRef.current[i] ??= { t: '', z: '', v: '' });
      const t = transformDaPose(pose);
      const z = String(pose.z);
      const v = pose.visivel ? 'visible' : 'hidden';
      if (t !== ant.t) { c.style.transform = t; ant.t = t; }
      if (z !== ant.z) { c.style.zIndex = z; ant.z = z; }
      if (v !== ant.v) { c.style.visibility = v; ant.v = v; }
    });
  }, []);

  // Mede e posiciona (montagem, meta nova).
  useEffect(() => {
    naRolagemRef.current = macoNaRolagem();
    escritoRef.current = [];
    aplicarPoses();
  }, [aplicarPoses, total]);

  useEffect(() => {
    const el = trilhoRef.current;
    const secao = secaoRef.current;
    if (!el || !secao) return;
    let quadro = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const temScrollend = 'onscrollend' in window;
    const aoRolar = () => {
      if (!naRolagemRef.current && !quadro) {
        quadro = requestAnimationFrame(() => { quadro = 0; aplicarPoses(); });
      }
      // Sem `scrollend` (iOS < 26): considera assentado depois de um instante sem rolagem.
      clearTimeout(espera);
      espera = setTimeout(assentar, temScrollend ? 600 : 120);
    };
    const aoAssentar = () => { clearTimeout(espera); assentar(); };
    const aoRedimensionar = () => { escritoRef.current = []; aplicarPoses(); };
    // "Segurar" o cartão é só uma classe (sem re-render no começo do gesto).
    const pegar = () => secao.classList.add('maco-segurando');
    const soltar = () => secao.classList.remove('maco-segurando');
    el.addEventListener('scroll', aoRolar, { passive: true });
    el.addEventListener('scrollend', aoAssentar, { passive: true });
    el.addEventListener('touchstart', pegar, { passive: true });
    el.addEventListener('touchend', soltar, { passive: true });
    el.addEventListener('touchcancel', soltar, { passive: true });
    window.addEventListener('resize', aoRedimensionar, { passive: true });
    return () => {
      el.removeEventListener('scroll', aoRolar);
      el.removeEventListener('scrollend', aoAssentar);
      el.removeEventListener('touchstart', pegar);
      el.removeEventListener('touchend', soltar);
      el.removeEventListener('touchcancel', soltar);
      window.removeEventListener('resize', aoRedimensionar);
      cancelAnimationFrame(quadro);
      clearTimeout(espera);
    };
  }, [aplicarPoses, assentar]);

  // Cartões de trás não recebem foco nem toque (o da frente é o que vale); `inert` via DOM por compatibilidade.
  useEffect(() => {
    cartoesRef.current.forEach((c, i) => {
      if (c) (c as HTMLDivElement & { inert: boolean }).inert = i !== atual;
    });
  }, [atual, total]);

  // Meta apagada estando no cartão 3: volta para o último que existe.
  useEffect(() => {
    if (atual > total - 1) {
      atualRef.current = total - 1;
      setAtual(total - 1);
    }
  }, [atual, total]);

  const irPara = useCallback(
    (i: number) => {
      const el = trilhoRef.current;
      const alvo = Math.max(0, Math.min(total - 1, i));
      if (!el) return;
      el.scrollTo?.({ left: alvo * (el.clientWidth || 1), behavior: reduzMovimento() ? 'auto' : 'smooth' });
      atualRef.current = alvo;
      setAtual(alvo);
      setAnuncio(`Cartão ${alvo + 1} de ${total}: ${paginas[alvo]!.titulo}`);
    },
    [paginas, total],
  );

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); irPara(atual + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(atual - 1); }
  };

  const rotulo = (i: number) => `${i + 1} de ${total}: ${paginas[i]!.titulo}`;
  // Pose inicial (antes do JS medir): o 1º na frente, os outros atrás à direita.
  const poseInicial = (i: number) => {
    const pose = poseDoCartao(i, 340);
    return { transform: transformDaPose(pose), zIndex: pose.z, visibility: pose.visivel ? ('visible' as const) : ('hidden' as const) };
  };
  const refCartao = (i: number) => (el: HTMLDivElement | null) => {
    cartoesRef.current[i] = el;
  };
  cartoesRef.current.length = total;
  const alternarContas = useCallback(() => setContasAbertas((a) => !a), []);
  const css = useMemo(() => cssDoMaco(total), [total]);

  return (
    <section ref={secaoRef} aria-roledescription="carrossel" aria-label="Resumo do mês" data-testid="cartao-resumo" data-paginas={total} className="maco-secao">
      {/* eslint-disable-next-line react/no-danger -- CSS gerado aqui mesmo (keyframes do maço), sem dado do usuário */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="maco-palco relative -mx-4 overflow-x-clip md:mx-0" data-total={total} data-testid="cartao-maco">
        {/* Trilho invisível: é ele que rola (dedo, inércia, teclado); os cartões só desenham a pose. */}
        <div
          id={idTrilho}
          ref={trilhoRef}
          tabIndex={0}
          onKeyDown={aoTeclar}
          aria-label="Cartões do resumo do mês. Deslize para o lado ou use as setas."
          className="maco-trilho sem-barra absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {paginas.map((p) => (
            <div key={p.id} className="h-full w-full shrink-0 snap-center snap-always" aria-hidden="true" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 z-10">
          <Cartao i={0} total={total} atual={atual} refEl={refCartao(0)} estilo={poseInicial(0)} rotulo={rotulo(0)} testid="cartao-pagina-resumo">
            <CartaoResumo sobra={sobra} cofrinho={cofrinho} meta={meta} hojeISO={hojeISO} escondido={escondido} />
          </Cartao>
          <Cartao i={1} total={total} atual={atual} refEl={refCartao(1)} estilo={poseInicial(1)} rotulo={rotulo(1)} testid="cartao-pagina-conta" pele="cartao-pele-conta">
            <CartaoConta sobra={sobra} escondido={escondido} contasAbertas={contasAbertas} onContas={alternarContas} idLista={idListaContas} />
          </Cartao>
          {meta && (
            <Cartao i={2} total={total} atual={atual} refEl={refCartao(2)} estilo={poseInicial(2)} rotulo={rotulo(2)} testid="cartao-pagina-meta" pele="cartao-pele-meta">
              <CartaoMeta meta={meta} sobraMensal={sobra.valor} hojeISO={hojeISO} escondido={escondido} />
            </Cartao>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <BotaoRedondo onClick={() => irPara(atual - 1)} controla={idTrilho} rotulo={atual > 0 ? `Cartão anterior: ${paginas[atual - 1]!.titulo}` : 'Cartão anterior'} desligado={atual === 0}>
          <ChevronLeft size={16} aria-hidden="true" />
        </BotaoRedondo>
        <div className="flex flex-col items-center gap-1">
          <Pontos total={total} atual={atual} />
          <span className="text-[11px] text-muted" data-testid="cartao-posicao">
            {atual + 1} de {total} · {paginas[atual]?.titulo}
          </span>
        </div>
        {atual === total - 1 && paginas[atual]?.id === 'meta' ? (
          <Link href={METAS_PATH} className={clsx(CLASSE_REDONDO, 'w-auto pl-3 pr-2 text-[12.5px] font-medium text-accent')}>
            Guardar <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <BotaoRedondo onClick={() => irPara(atual + 1)} controla={idTrilho} rotulo={atual < total - 1 ? `Próximo cartão: ${paginas[atual + 1]!.titulo}` : 'Próximo cartão'} desligado={atual === total - 1}>
            <ChevronRight size={16} aria-hidden="true" />
          </BotaoRedondo>
        )}
      </div>

      {contasAbertas && <ListaContasFixas sobra={sobra} escondido={escondido} id={idListaContas} mes={mes} />}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{anuncio}</p>
    </section>
  );
}

/** Visual pequeno (30px), área de toque de 44px pelo ::before (WCAG 2.5.8 pede ≥ 24px). */
const CLASSE_REDONDO =
  "lap-cartao relative inline-flex h-[30px] min-w-[30px] items-center justify-center gap-0.5 rounded-full before:absolute before:-inset-y-[7px] before:-inset-x-[7px] before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function BotaoRedondo({ children, onClick, controla, rotulo, desligado }: { children: ReactNode; onClick: () => void; controla: string; rotulo: string; desligado: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-controls={controla} aria-label={rotulo} disabled={desligado} className={clsx(CLASSE_REDONDO, 'w-[30px] text-accent disabled:text-muted disabled:opacity-45')}>
      {children}
    </button>
  );
}

function Pontos({ total, atual }: { total: number; atual: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true" data-testid="cartao-pontos">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={clsx('block h-1.5 rounded-full transition-colors motion-reduce:transition-none', i === atual ? 'w-4 bg-accent' : 'w-1.5 bg-text/20')} />
      ))}
    </span>
  );
}

function Cartao({ children, i, atual, refEl, estilo, rotulo, testid, pele }: {
  children: ReactNode; i: number; total: number; atual: number; refEl: (el: HTMLDivElement | null) => void;
  estilo: { transform: string; zIndex: number; visibility: 'visible' | 'hidden' }; rotulo: string; testid: string; pele?: string;
}) {
  // O estilo inicial é passado uma vez só (useState): depois quem move o cartão é o trilho, direto no DOM.
  const [inicial] = useState(estilo);
  return (
    <div
      ref={refEl}
      role="group"
      aria-roledescription="cartão"
      aria-label={rotulo}
      data-testid={testid}
      style={inicial}
      data-i={i}
      className={clsx('maco-cartao absolute inset-x-0 top-[17px] mx-auto aspect-[1.586] origin-[50%_120%]', i === atual && 'cartao-frente')}
    >
      <div className={clsx('lap-heroi cartao-cc flex h-full flex-col px-4 pb-3.5 pt-[15px]', pele)}>{children}</div>
    </div>
  );
}

function Cabeca({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div className="flex min-h-[22px] items-center justify-between gap-2">
      {children}
      {direita}
    </div>
  );
}

const ROTULO = 'lap-rotulo lap-texto-3 flex min-w-0 items-center gap-2 text-[10.5px] font-normal tracking-[0.09em]';
const ROTULO_PEQ = 'lap-rotulo lap-texto-3 text-[9.5px] tracking-[0.09em]';
const MARCA = <span className="lap-texto-3 font-mono text-[11px] tracking-[0.16em]" aria-hidden="true">MEUDIA</span>;

const CartaoResumo = memo(function CartaoResumo({ sobra, cofrinho, meta, hojeISO, escondido }: { sobra: SobraDoMes; cofrinho: number; meta: MetaDoCartao | null; hojeISO: string; escondido: boolean }) {
  const pct = pctComprometida(sobra);
  const pctBarra = pct === null ? 0 : Math.min(Math.max(pct, 0), 100);
  const situacao = SITUACAO[situacaoDo(pct, sobra.valor) ?? 'no-controle'];
  const fimMes = formatDiaMes(fimDoMes(sobra.competencia));
  const valorCofrinho = escondido ? VALOR_OCULTO : formatBRLSinal(cofrinho);
  const progresso = meta ? progressoMeta(meta, hojeISO) : null;
  return (
    <>
      <Cabeca direita={pct !== null && <span className={clsx(PILULA, situacao.classe)}>{situacao.texto}</span>}>
        <h2 className={ROTULO}>
          <i className="cartao-chip" aria-hidden="true" />
          <span className="truncate"><span className="capitalize">{nomeMes(sobra.competencia)}</span> · deve sobrar</span>
        </h2>
      </Cabeca>
      <p
        data-testid="cartao-sobra-valor"
        className={clsx(
          'mt-3 whitespace-nowrap text-[40px] font-light leading-none tracking-[-0.04em] tabular-nums',
          sobra.valor < 0 && !escondido ? 'text-[var(--lap-h-alerta)]' : 'text-[var(--lap-h-positivo)]',
        )}
      >
        {escondido ? VALOR_OCULTO : <NumeroAnimado valor={sobra.valor} formatar={formatBRLSinal} />}
      </p>
      <p className="lap-texto-2 mt-1 truncate text-[12.5px]" data-testid="resumo-comprometida">
        {pct === null ? 'Cadastre sua renda para ver quanto sobra.' : sobra.valor < 0 ? `${pct}% da renda já foi · fecha em ${fimMes}` : `até ${fimMes} · ${pct}% da renda já tem destino`}
      </p>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-text/15"
        role="progressbar"
        aria-label="Renda do mês com destino"
        aria-valuenow={pctBarra}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={pct === null ? 'sem renda no mês' : `${pct}% da renda já tem destino (contas fixas e gastos)`}
      >
        <span className="lap-barra-luz block h-full rounded-full" style={{ width: `${pctBarra}%` }} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <Link
          href={BANCOS_PATH}
          data-testid="linha-cofrinho"
          aria-label={`Cofrinho: ${escondido ? 'valor oculto' : valorCofrinho}. Abrir Bancos para guardar, tirar ou corrigir`}
          className="pointer-events-auto -mb-1.5 flex min-h-[44px] min-w-0 flex-col justify-end pb-1.5"
        >
          <span className={clsx(ROTULO_PEQ, 'flex items-center gap-1')}>
            <PiggyBank size={12} aria-hidden="true" className="text-[var(--lap-h-positivo)]" /> Cofrinho <ChevronRight size={11} aria-hidden="true" />
          </span>
          <span data-testid="linha-cofrinho-valor" className="text-[14px] font-medium tabular-nums text-text">{valorCofrinho}</span>
        </Link>
        {meta && progresso ? (
          <div className="min-w-0 text-right" data-testid="cartao-meta-mini">
            <p className={clsx(ROTULO_PEQ, 'truncate')}>Meta · {meta.nome}</p>
            <p className="text-[14px] font-medium tabular-nums">{progresso.pct}%</p>
          </div>
        ) : (
          MARCA
        )}
      </div>
    </>
  );
});

const CartaoConta = memo(function CartaoConta({ sobra, escondido, contasAbertas, onContas, idLista }: { sobra: SobraDoMes; escondido: boolean; contasAbertas: boolean; onContas: () => void; idLista: string }) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const mes = nomeMes(sobra.competencia);
  const linha = 'flex min-h-[26px] items-center justify-between gap-2 text-[13.5px]';
  return (
    <section aria-labelledby="resumo-mes" data-testid="resumo-mes-conta" className="flex h-full flex-col">
      <Cabeca direita={MARCA}>
        <h2 id="resumo-mes" className={ROTULO}>
          <i className="cartao-chip" aria-hidden="true" />
          <span className="truncate">A conta de {mes}</span>
        </h2>
      </Cabeca>
      <dl className="mt-2">
        <div className={linha}>
          <dt className="lap-texto-2 flex items-center gap-1.5">
            Você recebe
            {sobra.previsao && (
              <span data-testid="renda-previsao" className="lap-texto-3 rounded-full border border-text/20 px-1.5 text-[10.5px] leading-[16px]">previsão</span>
            )}
          </dt>
          <dd data-testid="resumo-renda" className="whitespace-nowrap font-medium tabular-nums text-text">{v(sobra.renda.total)}</dd>
        </div>
        <div>
          <dt>
            <button
              type="button"
              onClick={onContas}
              aria-expanded={contasAbertas}
              aria-controls={contasAbertas ? idLista : undefined}
              className={clsx(linha, 'lap-texto-2 pointer-events-auto -mx-1 w-[calc(100%+0.5rem)] rounded-md px-1 text-left')}
            >
              <span className="flex items-center gap-0.5">
                Contas fixas
                <ChevronDown size={14} aria-hidden="true" className={clsx('transition-transform motion-reduce:transition-none', contasAbertas && 'rotate-180')} />
                <span className="sr-only">{contasAbertas ? '(esconder lista)' : '(ver lista)'}</span>
              </span>
              <span data-testid="resumo-contas-fixas" className="whitespace-nowrap font-medium tabular-nums text-text">
                {escondido ? VALOR_OCULTO : `− ${formatBRL(sobra.totalContasFixas)}`}
              </span>
            </button>
          </dt>
        </div>
        <div className={linha}>
          <dt className="lap-texto-2">Gastos do mês</dt>
          <dd data-testid="resumo-gastos" className="whitespace-nowrap font-medium tabular-nums text-text">
            {escondido ? VALOR_OCULTO : `− ${formatBRL(sobra.gastosExtras)}`}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-text/15 pt-2">
        <p className="lap-texto-2 pb-1 text-[13.5px]">Deve sobrar</p>
        <p
          data-testid="previsao-fim-mes-valor"
          className={clsx(
            'whitespace-nowrap text-[26px] font-light leading-[1.1] tracking-[-0.03em] tabular-nums',
            sobra.valor < 0 && !escondido ? 'text-[var(--lap-h-alerta)]' : 'text-[var(--lap-h-positivo)]',
          )}
        >
          {escondido ? VALOR_OCULTO : <NumeroAnimado valor={sobra.valor} formatar={formatBRLSinal} />}
        </p>
      </div>
    </section>
  );
});

/** A lista das contas fixas abre logo abaixo do maço (no cartão não cabe). */
function ListaContasFixas({ sobra, escondido, id, mes }: { sobra: SobraDoMes; escondido: boolean; id: string; mes: string }) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const pagas = sobra.contasFixas.filter((c) => c.paga).length;
  const aPagar = sobra.contasFixas.length - pagas;
  return (
    <div className="lap-cartao mt-2 px-4 py-3" data-testid="cartao-contas-fixas">
      <p className="text-[12px] text-muted" data-testid="resumo-contas-fixas-status">
        {sobra.contasFixas.length === 0 ? 'Nenhuma conta fixa cadastrada' : `${pagas} paga${pagas === 1 ? '' : 's'} · ${aPagar} a pagar · pagas ou não, já contam na conta`}
      </p>
      {sobra.contasFixas.length > 0 && (
        <ul id={id} aria-label={`Contas fixas de ${mes}`} className="mt-1 divide-y divide-border">
          {sobra.contasFixas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate text-text">{c.descricao}</span>
                <span className="text-[11px] text-muted">{c.paga && c.pagoEm ? `pago em ${formatDiaMes(c.pagoEm)}` : `vence ${formatDiaMes(c.vencimento)}`}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-text">{v(c.valor)}</span>
                <span className={clsx('rounded-full border px-1.5 text-[11px] leading-[18px]', c.paga ? 'border-green/40 text-green' : 'border-yellow/40 text-yellow')}>
                  {c.paga ? 'pago' : 'a pagar'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RITMO: Record<'a_frente' | 'no_ritmo' | 'atras', { texto: string; classe: string }> = {
  a_frente: { texto: 'à frente do ritmo', classe: 'border-[color-mix(in_oklch,var(--lap-h-positivo)_30%,transparent)] bg-[color-mix(in_oklch,var(--lap-h-positivo)_14%,transparent)] text-[var(--lap-h-positivo)]' },
  no_ritmo: { texto: 'no ritmo', classe: 'border-text/20 bg-text/10 text-text' },
  atras: { texto: 'atrás do ritmo', classe: 'border-yellow/30 bg-yellow/[0.12] text-yellow' },
};

const CartaoMeta = memo(function CartaoMeta({ meta, sobraMensal, hojeISO, escondido }: { meta: MetaDoCartao; sobraMensal: number; hojeISO: string; escondido: boolean }) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  const vCurto = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n).replace(/,00$/, ''));
  const p = progressoMeta(meta, hojeISO);
  const s = sugestaoMeta({ hojeISO, sobraMensal, valorAlvo: meta.valor_alvo, valorGuardado: meta.valor_guardado, dataLimite: meta.data_limite });
  const ritmo = p.ritmo && !p.alcancada ? RITMO[p.ritmo] : null;
  let guardar: { valor: string; nota: string };
  if (p.alcancada) guardar = { valor: '—', nota: 'meta alcançada' };
  else if (s.porMes !== null) guardar = { valor: vCurto(s.porMes), nota: s.tipo === 'cabe' ? 'cabe na sobra' : 'acima da sobra' };
  else if (s.metadeDaSobra) guardar = { valor: vCurto(s.metadeDaSobra.porMes), nota: 'metade da sobra' };
  else if (s.sobraInteira) guardar = { valor: vCurto(s.sobraInteira.porMes), nota: 'a sobra do mês' };
  else guardar = { valor: '—', nota: 'sem sobra no mês' };

  return (
    <>
      <Cabeca
        direita={
          p.alcancada ? (
            <span className={clsx(PILULA, RITMO.a_frente.classe)}>alcançada 🎉</span>
          ) : ritmo ? (
            <span data-testid="cartao-meta-ritmo" className={clsx(PILULA, ritmo.classe)}>{ritmo.texto}</span>
          ) : null
        }
      >
        <h2 className={ROTULO}>
          <IconeMeta icone={meta.icone} className="h-[22px] w-[22px] shrink-0 rounded-md [&>svg]:h-3 [&>svg]:w-3" />
          <span className="truncate">Meta · {meta.nome}</span>
        </h2>
      </Cabeca>
      <div className="mt-2.5 flex items-baseline gap-2.5">
        <p data-testid="cartao-meta-pct" className="text-[40px] font-light leading-none tracking-[-0.04em] tabular-nums text-[var(--lap-h-positivo)]">
          {p.pct}
          <span className="ml-0.5 text-xl">%</span>
        </p>
        <p className="lap-texto-2 min-w-0 truncate text-[12.5px]" data-testid="cartao-meta-valores">
          {v(meta.valor_guardado)} guardados de {v(meta.valor_alvo)}
        </p>
      </div>
      <div
        className="relative mt-3 h-1.5 rounded-full bg-text/15"
        role="progressbar"
        aria-label={`Meta ${meta.nome}`}
        aria-valuenow={p.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${p.pct}% guardado${p.pctEsperado !== null ? `; pelo ritmo, hoje seria ${p.pctEsperado}%` : ''}`}
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--lap-h-positivo)]" style={{ width: `${p.pct}%` }} />
        {p.pctEsperado !== null && !p.alcancada && (
          <span className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded bg-text/70" style={{ left: `${p.pctEsperado}%` }} data-testid="cartao-meta-hoje" title={`hoje ${p.pctEsperado}%`}>
            <span className="sr-only">hoje {p.pctEsperado}%</span>
          </span>
        )}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-1.5">
        <Celula rotulo="Faltam" testid="cartao-meta-falta" valor={p.alcancada ? 'nada' : vCurto(p.falta)} />
        <Celula rotulo="Por mês" testid="cartao-meta-guardar" valor={guardar.valor} nota={guardar.nota} />
        <Celula rotulo="Até" valor={meta.data_limite ? mesCurto(meta.data_limite) : 'sem prazo'} />
      </div>
    </>
  );
});

function Celula({ rotulo, valor, nota, testid }: { rotulo: string; valor: string; nota?: string; testid?: string }) {
  return (
    <div className="lap-vidro min-w-0 px-2 py-1.5" data-testid={testid}>
      <p className={ROTULO_PEQ}>{rotulo}</p>
      <p className="truncate text-[13px] font-medium tabular-nums text-text">{valor}</p>
      {nota && <p className="lap-texto-3 truncate text-[10px] leading-tight">{nota}</p>}
    </div>
  );
}

function fimDoMes(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${competencia}-${String(dia).padStart(2, '0')}`;
}
