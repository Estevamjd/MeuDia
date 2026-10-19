'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronDown, Plus } from 'lucide-react';
import { hojeSP, ultimasDespesas, type Transacao } from '@meudia/shared';
import { usePainelSaldo, useResumoFinanceiroMes, useTransacoesMes } from '../../../../hooks';
import { Button, SkeletonList } from '../../../../components/ui';
import { ConfirmarExclusao } from '../../../../components/financas/ConfirmarExclusao';
import { LancamentoRapidoSheet } from '../../../../components/financas/LancamentoRapidoSheet';
import { useLancamentoModais } from '../../../../components/financas/LancamentoModais';
import { LinhaLancamento } from '../../../../components/financas/LinhaLancamento';
import { SeletorMes } from '../../../../components/financas/SeletorMes';
import { useExclusaoLancamento } from '../../../../components/financas/useExclusaoLancamento';
import { AnaliseMes } from '../../../../components/financas/gastos/AnaliseMes';
import { montarAnalise } from '../../../../components/financas/gastos/montarAnalise';
import { montarDashboard } from '../../../../components/financas/home/montarDashboard';
import { lerEsconderValores } from '../../../../lib/carteiras-ui';
import { deslocarCompetencia, formatBRL, formatDiaMes, partesCompetencia } from '../../../../lib/financas-ui';
import { filtrosGastos, hrefGastos, type AbaGastos } from '../../../../lib/gastos-url';

export default function GastosPage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <Gastos />
    </Suspense>
  );
}

const ABAS: { aba: AbaGastos; rotulo: string }[] = [
  { aba: 'despesas', rotulo: 'Últimas despesas' },
  { aba: 'analise', rotulo: 'Análise' },
];

/** Aba Gastos: Últimas despesas (filtros de mês e categoria na URL) | Análise. */
function Gastos() {
  const router = useRouter();
  const params = useSearchParams();
  const hojeISO = useMemo(() => hojeSP(), []);
  const filtros = filtrosGastos(params, hojeISO);
  const ir = (mudanca: Parameters<typeof hrefGastos>[1]) => router.replace(hrefGastos(filtros, mudanca, hojeISO), { scroll: false });
  const { ano, mes } = partesCompetencia(filtros.mes);
  const transacoes = useTransacoesMes(ano, mes);
  const lista = useMemo(() => transacoes.data ?? [], [transacoes.data]);
  const exclusao = useExclusaoLancamento(lista.map((t) => t.id));
  const lancamento = useLancamentoModais();
  const [gastei, setGastei] = useState(false);
  const acoes = { bloqueadas: exclusao.bloqueadas, onEditar: lancamento.abrirEdicao, onExcluir: exclusao.pedirExclusao };

  return (
    <div className="animate-fadeSlide space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-syne text-2xl font-bold text-text md:text-3xl">Gastos</h1>
        <SeletorMes competencia={filtros.mes} onMudar={(d) => ir({ mes: deslocarCompetencia(filtros.mes, d) })} />
      </div>

      <div role="tablist" aria-label="Seções de Gastos" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
        {ABAS.map(({ aba, rotulo }) => (
          <Link
            key={aba}
            role="tab"
            aria-selected={filtros.aba === aba}
            href={hrefGastos(filtros, { aba }, hojeISO)}
            replace
            scroll={false}
            className={clsx(
              'flex min-h-[44px] items-center justify-center rounded-lg text-sm font-medium transition-colors',
              filtros.aba === aba ? 'bg-accent/[0.18] text-accent' : 'text-muted hover:text-text',
            )}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {filtros.aba === 'analise' ? (
        <Analise competencia={filtros.mes} hojeISO={hojeISO} transacoes={lista} vinculos={exclusao.vinculos} acoes={acoes} />
      ) : (
        <UltimasDespesas
          transacoes={lista}
          carregando={transacoes.isLoading}
          erro={transacoes.isError}
          mes={filtros.mes}
          categoria={filtros.categoria}
          onCategoria={(categoria) => ir({ categoria })}
          onGastei={() => setGastei(true)}
          onNovo={lancamento.abrirNovo}
          vinculos={exclusao.vinculos}
          acoes={acoes}
        />
      )}

      <LancamentoRapidoSheet open={gastei} inicial="gastei" onClose={() => setGastei(false)} />
      {lancamento.modais}
      <ConfirmarExclusao
        isOpen={!!exclusao.exclusao}
        onClose={() => exclusao.exclusao?.onCancelar()}
        onConfirm={() => exclusao.exclusao?.onConfirmar()}
        titulo="Excluir lançamento"
        detalhe={exclusao.exclusao?.detalhe}
        isLoading={exclusao.exclusao?.carregando}
      />
    </div>
  );
}

type Acoes = { bloqueadas: boolean; onEditar: (t: Transacao) => void; onExcluir: (t: Transacao) => void };

interface UltimasDespesasProps {
  transacoes: Transacao[];
  carregando: boolean;
  erro: boolean;
  mes: string;
  categoria: string | null;
  onCategoria: (categoria: string | null) => void;
  onGastei: () => void;
  onNovo: () => void;
  vinculos: Record<string, 'recebimento' | 'pagamento'>;
  acoes: Acoes;
}

function UltimasDespesas({ transacoes, carregando, erro, mes, categoria, onCategoria, onGastei, onNovo, vinculos, acoes }: UltimasDespesasProps) {
  const r = useMemo(() => ultimasDespesas(transacoes, { mes, categoria }), [transacoes, mes, categoria]);
  // Categoria da URL sem despesa no mês continua no select (senão o filtro some da tela).
  const categorias = categoria && !r.categorias.includes(categoria) ? [...r.categorias, categoria] : r.categorias;
  return (
    <section aria-label="Últimas despesas" className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-categoria" className="sr-only">Categoria</label>
        {/* appearance-none: sem ela o WebKit do iPhone pinta o select nativo de branco e o texto some. */}
        <div className="relative min-w-0 flex-1">
          <select
            id="filtro-categoria"
            value={categoria ?? ''}
            onChange={(e) => onCategoria(e.target.value || null)}
            className="min-h-[44px] w-full appearance-none rounded-lg border border-border bg-card2 pl-3 pr-10 text-[15px] text-text [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
        <Button onClick={onGastei} className="min-h-[44px] shrink-0">
          <Plus size={16} aria-hidden="true" /> Gastei
        </Button>
      </div>

      <p className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-[15px]">
        <span className="text-muted">Total{categoria ? ` em ${categoria}` : ''}</span>
        <span data-testid="total-gastos" className="font-semibold tabular-nums text-red">{formatBRL(r.total)}</span>
      </p>

      {carregando ? (
        <SkeletonList count={3} />
      ) : erro ? (
        <p role="alert" className="rounded-card border border-red/40 bg-card p-4 text-[15px] text-text">Não foi possível carregar os gastos.</p>
      ) : r.dias.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-4 text-[15px] text-muted">Nenhuma despesa neste filtro.</p>
      ) : (
        r.dias.map((dia) => (
          <section key={dia.data} aria-label={`Despesas de ${formatDiaMes(dia.data)}`} className="space-y-1">
            <h2 className="flex justify-between px-1 text-[12px] font-medium uppercase text-muted">
              <span>{formatDiaMes(dia.data)}</span>
              <span className="tabular-nums">{formatBRL(dia.total)}</span>
            </h2>
            <ul className="space-y-1 rounded-xl border border-border bg-card px-4 py-1">
              {dia.itens.map((t) => (
                <LinhaLancamento key={t.id} t={t} vinculo={vinculos[t.id]} comCategoria acoes={acoes} />
              ))}
            </ul>
          </section>
        ))
      )}

      <Button variant="ghost" onClick={onNovo} className="min-h-[44px] w-full">
        <Plus size={16} aria-hidden="true" /> Novo lançamento
      </Button>
    </section>
  );
}

interface AnaliseProps {
  competencia: string;
  hojeISO: string;
  transacoes: Transacao[];
  vinculos: Record<string, 'recebimento' | 'pagamento'>;
  acoes: Acoes;
}

function Analise({ competencia, hojeISO, transacoes, vinculos, acoes }: AnaliseProps) {
  const { ano, mes } = partesCompetencia(competencia);
  const resumo = useResumoFinanceiroMes(ano, mes);
  const painel = usePainelSaldo(hojeISO);
  const [escondido] = useState(lerEsconderValores);
  const graficos = useMemo(
    () => (painel.data ? montarDashboard(competencia, hojeISO, painel.data, transacoes) : null),
    [competencia, hojeISO, painel.data, transacoes],
  );
  if (resumo.isLoading) return <SkeletonList count={3} />;
  if (!resumo.data) {
    return <p role="alert" className="rounded-card border border-red/40 bg-card p-4 text-[15px] text-text">Não foi possível carregar a análise do mês.</p>;
  }
  const entradas = transacoes
    .filter((t) => t.tipo === 'receita' && !t.ajuste)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return (
    <AnaliseMes
      analise={montarAnalise(resumo.data, competencia)}
      fatias={graficos?.fatias ?? []}
      evolucao={graficos?.evolucao ?? []}
      escondido={escondido}
      listaEntradas={
        entradas.length > 0 && (
          <ul aria-label="Entradas do mês" className="border-t border-border pt-1">
            {entradas.map((t) => (
              <LinhaLancamento key={t.id} t={t} vinculo={vinculos[t.id]} acoes={acoes} />
            ))}
          </ul>
        )
      }
    />
  );
}
