'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { hojeSP, ultimasDespesas, type OcorrenciaConta, type Transacao } from '@meudia/shared';
import { useContasMes, useHistoricoSaldoMes, usePainelSaldo, useResumoFinanceiroMes, useTransacoesMes } from '../../../../hooks';
import { Button, SkeletonList } from '../../../../components/ui';
import { ConfirmarExclusao } from '../../../../components/financas/ConfirmarExclusao';
import { LancamentoRapidoSheet } from '../../../../components/financas/LancamentoRapidoSheet';
import { useLancamentoModais } from '../../../../components/financas/LancamentoModais';
import { LinhaLancamento } from '../../../../components/financas/LinhaLancamento';
import { SeletorMes } from '../../../../components/financas/SeletorMes';
import { useExclusaoLancamento } from '../../../../components/financas/useExclusaoLancamento';
import { AnaliseMes } from '../../../../components/financas/gastos/AnaliseMes';
import { montarAnalise } from '../../../../components/financas/gastos/montarAnalise';
import { ContasFixasMes } from '../../../../components/financas/gastos/ContasFixasMes';
import { contasFixasDoMes } from '../../../../components/financas/gastos/contasFixasDoMes';
import { usePagamentoAcoes } from '../../../../components/financas/usePagamentoAcoes';
import { montarDashboard } from '../../../../components/financas/home/montarDashboard';
import { lerEsconderValores } from '../../../../lib/carteiras-ui';
import { deslocarCompetencia, formatBRL, formatDiaMes, nomeMes, partesCompetencia } from '../../../../lib/financas-ui';
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
  // Ação de fora do campo de busca (mês, categoria, Só WhatsApp, Limpar filtros): descarta a busca ainda no atraso,
  // mesmo quando o `q` da URL não muda (ver `CampoBusca`).
  const [acoesExternas, setAcoesExternas] = useState(0);
  const irPorFora = (mudanca: Parameters<typeof hrefGastos>[1]) => {
    setAcoesExternas((n) => n + 1);
    ir(mudanca);
  };
  const { ano, mes } = partesCompetencia(filtros.mes);
  const transacoes = useTransacoesMes(ano, mes);
  const ocorrencias = useContasMes(filtros.mes);
  const lista = useMemo(() => transacoes.data ?? [], [transacoes.data]);
  const exclusao = useExclusaoLancamento(lista.map((t) => t.id));
  const lancamento = useLancamentoModais();
  const [gastei, setGastei] = useState(false);
  const acoes = { bloqueadas: exclusao.bloqueadas, onEditar: lancamento.abrirEdicao, onExcluir: exclusao.pedirExclusao };

  return (
    <div className="animate-fadeSlide space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-syne text-2xl font-bold text-text md:text-3xl">Gastos</h1>
        <SeletorMes competencia={filtros.mes} onMudar={(d) => irPorFora({ mes: deslocarCompetencia(filtros.mes, d) })} />
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
          ocorrencias={ocorrencias.data ?? []}
          carregando={transacoes.isLoading}
          erro={transacoes.isError}
          mes={filtros.mes}
          categoria={filtros.categoria}
          onCategoria={(categoria) => irPorFora({ categoria })}
          busca={filtros.busca}
          onBusca={(busca) => ir({ busca })}
          soWhatsapp={filtros.soWhatsapp}
          onSoWhatsapp={(soWhatsapp) => irPorFora({ soWhatsapp })}
          onLimparFiltros={() => irPorFora({ busca: '', soWhatsapp: false, categoria: null })}
          acoesExternas={acoesExternas}
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
        parcela={exclusao.exclusao?.parcela}
      />
    </div>
  );
}

type Acoes = { bloqueadas: boolean; onEditar: (t: Transacao) => void; onExcluir: (t: Transacao) => void };

interface UltimasDespesasProps {
  transacoes: Transacao[];
  ocorrencias: OcorrenciaConta[];
  carregando: boolean;
  erro: boolean;
  mes: string;
  categoria: string | null;
  onCategoria: (categoria: string | null) => void;
  /** Busca e "Só WhatsApp" (na URL); filtram a lista do mês já carregada, sem consulta nova. */
  busca: string;
  onBusca: (busca: string) => void;
  soWhatsapp: boolean;
  onSoWhatsapp: (ligado: boolean) => void;
  onLimparFiltros: () => void;
  /** Muda a cada ação de fora do campo de busca: remonta o campo e cancela o atraso pendente. */
  acoesExternas: number;
  onGastei: () => void;
  onNovo: () => void;
  vinculos: Record<string, 'recebimento' | 'pagamento'>;
  acoes: Acoes;
}

function UltimasDespesas({ transacoes, ocorrencias, carregando, erro, mes, categoria, onCategoria, busca, onBusca, soWhatsapp, onSoWhatsapp, onLimparFiltros, acoesExternas, onGastei, onNovo, vinculos, acoes }: UltimasDespesasProps) {
  // "Paguei" é a conta fixa (vai no card de contas), não gasto do dia a dia: assim o total bate com a Início.
  const extras = useMemo(() => transacoes.filter((t) => vinculos[t.id] !== 'pagamento'), [transacoes, vinculos]);
  const r = useMemo(() => ultimasDespesas(extras, { mes, categoria, busca, soWhatsapp }), [extras, mes, categoria, busca, soWhatsapp]);
  // Categorias do select: as do mês inteiro (a busca não pode esvaziar a lista de onde se escolhe).
  const categoriasDoMes = useMemo(() => ultimasDespesas(extras, { mes }).categorias, [extras, mes]);
  const buscando = !!busca.trim() || soWhatsapp;
  const contas = useMemo(() => contasFixasDoMes(ocorrencias, transacoes, categoria), [ocorrencias, transacoes, categoria]);
  const { desfazerPagamento, contaOcupada } = usePagamentoAcoes();
  // Categoria da URL sem despesa no mês continua no select (senão o filtro some da tela).
  const categorias = categoria && !categoriasDoMes.includes(categoria) ? [...categoriasDoMes, categoria] : categoriasDoMes;
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

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {/* A chave junta o resto dos filtros (inclusive voltar/avançar do navegador) e as ações de fora: qualquer
              mudança remonta o campo, o que limpa o atraso pendente e devolve o texto ao `q` da URL. */}
          <CampoBusca key={`${mes}|${categoria ?? ''}|${soWhatsapp}|${acoesExternas}`} valor={busca} onMudar={onBusca} />
          <button
            type="button"
            aria-pressed={soWhatsapp}
            onClick={() => onSoWhatsapp(!soWhatsapp)}
            data-testid="gastos-so-whatsapp"
            className={clsx(
              'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-3 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              soWhatsapp ? 'border-accent bg-accent/[0.18] text-accent' : 'border-border bg-card2 text-muted hover:text-text',
            )}
          >
            Só WhatsApp
          </button>
        </div>
        {buscando && (
          <p className="px-1 text-[12px] text-muted" data-testid="gastos-busca-escopo">
            Buscando só em <span className="capitalize">{nomeMes(mes)}</span>.
          </p>
        )}
      </div>

      <ContasFixasMes
        mes={mes}
        contas={contas}
        ocupada={contaOcupada}
        onDesfazer={(c) => desfazerPagamento({ contaId: c.id, competencia: mes, descricao: c.descricao })}
      />

      <p className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-[15px]">
        <span className="text-muted">
          {buscando ? 'Gastos encontrados' : 'Gastos do mês'}{categoria ? ` em ${categoria}` : ''} <span className="text-[12px]">(fora as contas fixas)</span>
        </span>
        <span data-testid="total-gastos" className="font-semibold tabular-nums text-red">{formatBRL(r.total)}</span>
      </p>

      {carregando ? (
        <SkeletonList count={3} />
      ) : erro ? (
        <p role="alert" className="rounded-card border border-red/40 bg-card p-4 text-[15px] text-text">Não foi possível carregar os gastos.</p>
      ) : r.dias.length === 0 && buscando ? (
        <div className="space-y-3 rounded-card border border-border bg-card p-4 text-center" data-testid="gastos-busca-vazia">
          <p className="text-[15px] text-text">
            {busca.trim() ? <>Nada com &ldquo;{busca.trim()}&rdquo;</> : 'Nenhum gasto pelo WhatsApp'}
            {busca.trim() && soWhatsapp ? ' pelo WhatsApp' : ''} em <span className="capitalize">{nomeMes(mes)}</span>.
          </p>
          <p className="text-[13px] text-muted">Tente outra palavra ou troque o mês.</p>
          <Button variant="ghost" onClick={onLimparFiltros} className="min-h-[44px]">
            Limpar filtros
          </Button>
        </div>
      ) : r.dias.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-4 text-[15px] text-muted">Nenhum gasto fora das contas fixas neste filtro.</p>
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

/** Atraso da busca: digita sem trocar a URL a cada letra. */
const ESPERA_BUSCA_MS = 200;

/**
 * Campo "Buscar gasto": o texto vive aqui e vai para a URL 200 ms depois da última tecla (o X limpa na hora). Se a
 * URL mudar por fora (Limpar filtros, voltar), o campo acompanha.
 *
 * Regra do atraso: qualquer ação fora do campo antes dos 200 ms (trocar o mês, a categoria, "Só WhatsApp", "Limpar
 * filtros", voltar/avançar) descarta o texto ainda não enviado; o campo volta ao `q` da URL e nada é reaplicado
 * depois. Quem remonta o campo é a `key` dada por `UltimasDespesas`.
 */
function CampoBusca({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const [valorAntes, setValorAntes] = useState(valor);
  const enviadoRef = useRef(valor);
  const onMudarRef = useRef(onMudar);
  onMudarRef.current = onMudar;
  if (valor !== valorAntes) {
    setValorAntes(valor);
    if (valor !== enviadoRef.current) {
      enviadoRef.current = valor;
      setTexto(valor);
    }
  }
  useEffect(() => {
    if (texto === enviadoRef.current) return;
    const t = setTimeout(() => {
      enviadoRef.current = texto;
      onMudarRef.current(texto);
    }, ESPERA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [texto]);
  const limpar = () => {
    setTexto('');
    enviadoRef.current = '';
    onMudarRef.current('');
  };
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="busca-gasto" className="sr-only">Buscar gasto</label>
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id="busca-gasto"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Buscar gasto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="min-h-[44px] w-full appearance-none rounded-lg border border-border bg-card2 pl-9 pr-11 text-[16px] text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {texto && (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:text-text"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
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
  // Linha de saldo: abertura de cada banco no fim do mês anterior + movimentos do mês (sem o histórico inteiro).
  const historico = useHistoricoSaldoMes(competencia);
  const [escondido] = useState(lerEsconderValores);
  const graficos = useMemo(
    () => (painel.data ? montarDashboard(competencia, hojeISO, painel.data, transacoes, historico.data) : null),
    [competencia, hojeISO, painel.data, transacoes, historico.data],
  );
  if (resumo.isLoading) return <SkeletonList count={3} />;
  if (!resumo.data) {
    return <p role="alert" className="rounded-card border border-red/40 bg-card p-4 text-[15px] text-text">Não foi possível carregar a análise do mês.</p>;
  }
  // Sem o histórico (ou sem o painel) a linha de saldo some: enquanto carrega não diz "sem dados"; no erro oferece
  // tentar de novo, refazendo só as consultas que falharam.
  const painelFalhou = painel.isError && !painel.data;
  const estadoEvolucao = historico.isError || painelFalhou ? 'erro' : historico.isPending || painel.isPending ? 'carregando' : 'ok';
  const tentarEvolucao = () => {
    if (painelFalhou) void painel.refetch();
    if (historico.isError) void historico.refetch();
  };
  const entradas = transacoes
    .filter((t) => t.tipo === 'receita' && !t.ajuste)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return (
    <AnaliseMes
      analise={montarAnalise(resumo.data, competencia)}
      fatias={graficos?.fatias ?? []}
      evolucao={graficos?.evolucao ?? []}
      escondido={escondido}
      estadoEvolucao={estadoEvolucao}
      onTentarEvolucao={tentarEvolucao}
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
