'use client';

import { useState, useMemo, useCallback } from 'react';
import { PieChart, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import type { OrcamentoCategoria, Renda } from '@meudia/shared';
import { competenciaDe, hojeSP } from '@meudia/shared';

import {
  useOrcamento,
  useSalvarOrcamento,
  useExcluirOrcamento,
  useRendas,
  useCriarRenda,
  useAtualizarRenda,
  useExcluirRenda,
  useResumoFinanceiroMes,
  useTransacoesMes,
} from '../../../../hooks';
import type { OrcamentoInput, RendaInput } from '../../../../hooks';

import {
  Badge,
  Button,
  Input,
  Modal,
  StatCard,
  EmptyState,
  SkeletonCard,
  SkeletonList,
  ProgressBar,
  ConfirmDialog,
  useToast,
} from '../../../../components/ui';
import { ConfirmarExclusao, detalheExclusaoRenda } from '../../../../components/financas/ConfirmarExclusao';
import {
  deslocarCompetencia,
  formatBRL,
  linhasOrcamento,
  parseValorNaoNegativo,
  parseValorPositivo,
  partesCompetencia,
  rotuloCompetencia,
  SITUACAO_LIMITE_UI,
  tagSobraPrevista,
  type LinhaOrcamento,
  type SituacaoLimite,
} from '../../../../lib/financas-ui';

const BARRA_COR: Record<SituacaoLimite, 'green' | 'orange' | 'red'> = {
  dentro: 'green',
  perto: 'orange',
  acima: 'red',
};

// Mobile e touch (sem hover): sempre visível. Desktop com mouse: hover ou foco por teclado.
const ACOES_CLASS =
  'flex shrink-0 gap-1 transition-opacity md:[@media(hover:hover)_and_(pointer:fine)]:opacity-0 focus-within:opacity-100 group-hover:opacity-100';

// --- Formulário de limite (montado a cada abertura do Modal) ---
interface LimiteFormProps {
  categoriaInicial: string;
  valorInicial: number | null;
  /** Editando um limite existente: a categoria é a chave do upsert, não muda. */
  categoriaFixa: boolean;
  sugestoes: string[];
  /** Categorias que já têm limite: o upsert sobrescreveria sem avisar. */
  existentes: string[];
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (data: OrcamentoInput) => void;
}

function LimiteForm({
  categoriaInicial,
  valorInicial,
  categoriaFixa,
  sugestoes,
  existentes,
  isLoading,
  onCancel,
  onSubmit,
}: LimiteFormProps) {
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [valor, setValor] = useState(valorInicial?.toString() ?? '');
  const [erro, setErro] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = categoria.trim();
    const valorPlanejado = parseValorNaoNegativo(valor);
    if (!nome || nome.length > 100) return setErro('Informe a categoria (até 100 caracteres).');
    if (!categoriaFixa && existentes.includes(nome)) return setErro('Esta categoria já tem limite. Edite o limite na lista.');
    if (valorPlanejado === null) return setErro('Informe um limite de zero ou mais.');
    setErro(undefined);
    onSubmit({ categoria: nome, valor_planejado: valorPlanejado });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        id="limite-categoria"
        label="Categoria"
        placeholder="Ex: Alimentação, Transporte..."
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        list="limite-categorias"
        maxLength={100}
        disabled={categoriaFixa}
        required
      />
      <datalist id="limite-categorias">
        {sugestoes.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Input
        id="limite-valor"
        label="Limite do mês (R$)"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0,00"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        required
      />
      {erro && (
        <p role="alert" className="text-sm text-red">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

// --- Formulário de renda ---
interface RendaFormProps {
  renda: Renda | null;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (data: RendaInput) => void;
}

function RendaForm({ renda, isLoading, onCancel, onSubmit }: RendaFormProps) {
  const [descricao, setDescricao] = useState(renda?.descricao ?? '');
  const [valor, setValor] = useState(renda ? String(renda.valor) : '');
  const [dia, setDia] = useState(renda?.dia_recebimento?.toString() ?? '');
  const [erro, setErro] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = descricao.trim();
    const valorRenda = parseValorPositivo(valor);
    const diaRecebimento = dia.trim() ? Number(dia) : null;
    if (!nome) return setErro('Informe a descrição da renda.');
    if (valorRenda === null) return setErro('Informe um valor maior que zero.');
    if (diaRecebimento !== null && (!Number.isInteger(diaRecebimento) || diaRecebimento < 1 || diaRecebimento > 31)) {
      return setErro('O dia do recebimento vai de 1 a 31.');
    }
    setErro(undefined);
    onSubmit({ descricao: nome, valor: valorRenda, dia_recebimento: diaRecebimento });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        id="renda-descricao"
        label="Descrição"
        placeholder="Ex: Salário, Freela..."
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={500}
        required
      />
      <Input
        id="renda-valor"
        label="Valor mensal (R$)"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        placeholder="0,00"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        required
      />
      <Input
        id="renda-dia"
        label="Dia do recebimento (opcional)"
        type="number"
        inputMode="numeric"
        min="1"
        max="31"
        placeholder="1-31"
        value={dia}
        onChange={(e) => setDia(e.target.value)}
      />
      {erro && (
        <p role="alert" className="text-sm text-red">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

function ErroCarregamento({ mensagem, onRetry, isFetching }: { mensagem: string; onRetry: () => void; isFetching: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-red/40 bg-card p-3 text-sm text-text">
      <span>{mensagem}</span>
      <Button variant="ghost" onClick={onRetry} isLoading={isFetching}>
        Tentar de novo
      </Button>
    </div>
  );
}

function Carregando({ texto, count }: { texto: string; count: number }) {
  return (
    <div role="status">
      <span className="sr-only">{texto}</span>
      <SkeletonList count={count} />
    </div>
  );
}

// --- Página ---
export default function OrcamentoPage() {
  const toast = useToast();

  // --- Seletor de mês (competência em SP, igual ao backend) ---
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeSP()));
  const { ano, mes } = partesCompetencia(competencia);
  const mesAnterior = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, -1)), []);
  const mesProximo = useCallback(() => setCompetencia((c) => deslocarCompetencia(c, 1)), []);

  // --- Dados ---
  const orcamento = useOrcamento();
  const transacoes = useTransacoesMes(ano, mes);
  const rendas = useRendas();
  const resumo = useResumoFinanceiroMes(ano, mes);

  // --- Mutations ---
  const salvarOrcamento = useSalvarOrcamento();
  const excluirOrcamento = useExcluirOrcamento();
  const criarRenda = useCriarRenda();
  const atualizarRenda = useAtualizarRenda();
  const excluirRenda = useExcluirRenda();

  // --- Modais ---
  const [limiteAberto, setLimiteAberto] = useState<{ categoria: string; orcamento: OrcamentoCategoria | null } | null>(null);
  const [excluindoLimite, setExcluindoLimite] = useState<OrcamentoCategoria | null>(null);
  const [rendaAberta, setRendaAberta] = useState<{ renda: Renda | null } | null>(null);
  const [excluindoRenda, setExcluindoRenda] = useState<Renda | null>(null);

  const linhas = useMemo(
    () => linhasOrcamento(orcamento.data ?? [], transacoes.data ?? []),
    [orcamento.data, transacoes.data],
  );
  const sugestoes = useMemo(
    () => linhas.filter((l) => l.orcamento === null).map((l) => l.categoria),
    [linhas],
  );

  // isPending (sem dados e sem erro): a lista nunca aparece montada sobre dados ausentes.
  const carregandoLimites = orcamento.isPending || transacoes.isPending;
  const erroLimites = orcamento.isError || transacoes.isError;
  const tentarLimites = useCallback(() => {
    if (orcamento.isError) void orcamento.refetch();
    if (transacoes.isError) void transacoes.refetch();
  }, [orcamento, transacoes]);

  // --- Handlers ---
  const handleSalvarLimite = useCallback(
    (data: OrcamentoInput) => {
      salvarOrcamento.mutate(data, {
        onSuccess: () => {
          toast.success('Limite salvo!');
          setLimiteAberto(null);
        },
        onError: () => toast.error('Não foi possível salvar o limite. Tente de novo.'),
      });
    },
    [salvarOrcamento, toast],
  );

  const handleExcluirLimite = useCallback(() => {
    if (!excluindoLimite) return;
    excluirOrcamento.mutate(excluindoLimite.id, {
      onSuccess: () => {
        toast.success('Limite excluído');
        setExcluindoLimite(null);
      },
      onError: () => toast.error('Não foi possível excluir o limite. Tente de novo.'),
    });
  }, [excluirOrcamento, excluindoLimite, toast]);

  const handleSalvarRenda = useCallback(
    (data: RendaInput) => {
      const editando = rendaAberta?.renda;
      const opcoes = {
        onSuccess: () => {
          toast.success(editando ? 'Renda atualizada!' : 'Renda cadastrada!');
          setRendaAberta(null);
        },
        onError: () => toast.error('Não foi possível salvar a renda. Tente de novo.'),
      };
      if (editando) atualizarRenda.mutate({ id: editando.id, data }, opcoes);
      else criarRenda.mutate(data, opcoes);
    },
    [rendaAberta, atualizarRenda, criarRenda, toast],
  );

  const handleExcluirRenda = useCallback(() => {
    if (!excluindoRenda) return;
    excluirRenda.mutate(excluindoRenda.id, {
      onSuccess: () => {
        toast.success('Renda excluída');
        setExcluindoRenda(null);
      },
      onError: () => toast.error('Não foi possível excluir a renda. Tente de novo.'),
    });
  }, [excluirRenda, excluindoRenda, toast]);

  // Sem a lista carregada, `existentes` fica vazio e o upsert sobrescreveria um limite sem aviso.
  const podeCriarLimite = orcamento.isSuccess;
  const abrirNovoLimite = useCallback(() => {
    if (podeCriarLimite) setLimiteAberto({ categoria: '', orcamento: null });
  }, [podeCriarLimite]);

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-syne text-3xl font-bold text-text">Orçamento</h1>
        <Button variant="ghost" onClick={abrirNovoLimite} disabled={!podeCriarLimite}>
          <Plus size={16} />
          Novo limite
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={mesAnterior}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-syne text-lg font-semibold text-text" aria-live="polite">
          {rotuloCompetencia(competencia)}
        </span>
        <button
          onClick={mesProximo}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Próximo mês"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Renda × gasto previsto × sobra prevista (atualiza ao salvar renda/limite) */}
      {resumo.isError && (
        <ErroCarregamento
          mensagem="Não foi possível carregar a previsão do mês (renda, gasto e sobra)."
          onRetry={() => void resumo.refetch()}
          isFetching={resumo.isFetching}
        />
      )}
      {resumo.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : resumo.data ? (
        <section aria-label="Previsão do mês" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Renda prevista" value={formatBRL(resumo.data.rendaPrevista)} icon={<TrendingUp size={16} />} />
          <StatCard label="Gasto previsto" value={formatBRL(resumo.data.gastoPrevisto)} icon={<TrendingDown size={16} />} />
          <StatCard
            label="Sobra prevista"
            value={formatBRL(resumo.data.sobraPrevista)}
            icon={<PiggyBank size={16} />}
            tag={tagSobraPrevista(resumo.data.sobraPrevista)}
          />
        </section>
      ) : null}

      {/* Limites por categoria */}
      <section aria-labelledby="limites-categoria" className="space-y-3">
        <div className="space-y-1">
          <h2 id="limites-categoria" className="font-syne text-lg font-semibold text-text">
            Limites por categoria (opcional)
          </h2>
          <p className="text-sm text-muted">Quer controlar quanto gasta com mercado, lazer etc.? Defina um teto.</p>
        </div>

        {carregandoLimites ? (
          <Carregando texto="Carregando orçamento do mês…" count={3} />
        ) : erroLimites ? (
          <ErroCarregamento
            mensagem="Não foi possível carregar o orçamento deste mês."
            onRetry={tentarLimites}
            isFetching={orcamento.isFetching || transacoes.isFetching}
          />
        ) : linhas.length === 0 ? (
          <EmptyState
            icon={<PieChart size={40} />}
            title="Nenhum limite definido"
            description="Defina quanto quer gastar por categoria e acompanhe o gasto do mês."
            actionLabel="Definir primeiro limite"
            onAction={abrirNovoLimite}
          />
        ) : (
          <ul className="space-y-2">
            {linhas.map((linha) => (
              <LinhaLimite
                key={linha.categoria}
                linha={linha}
                onDefinir={() => setLimiteAberto({ categoria: linha.categoria, orcamento: linha.orcamento })}
                onExcluir={() => linha.orcamento && setExcluindoLimite(linha.orcamento)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Rendas */}
      <section aria-labelledby="rendas-mes" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rendas-mes" className="font-syne text-lg font-semibold text-text">
            Rendas
          </h2>
          <Button variant="ghost" onClick={() => setRendaAberta({ renda: null })}>
            <Plus size={16} />
            Nova renda
          </Button>
        </div>

        {rendas.isLoading ? (
          <Carregando texto="Carregando rendas…" count={2} />
        ) : rendas.isError ? (
          <ErroCarregamento
            mensagem="Não foi possível carregar as rendas."
            onRetry={() => void rendas.refetch()}
            isFetching={rendas.isFetching}
          />
        ) : !rendas.data || rendas.data.length === 0 ? (
          <EmptyState
            icon={<Wallet size={40} />}
            title="Nenhuma renda cadastrada"
            description="Cadastre sua renda para ver a sobra prevista e o selo do mês."
            actionLabel="Cadastrar renda"
            onAction={() => setRendaAberta({ renda: null })}
          />
        ) : (
          <ul className="space-y-2">
            {rendas.data.map((renda) => (
              <li key={renda.id} className="group flex items-center gap-3 rounded-card border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text">
                    <span className="min-w-0 max-w-full truncate">{renda.descricao}</span>
                    {!renda.ativo && <Badge color="orange" className="shrink-0 whitespace-nowrap">Inativa</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {renda.dia_recebimento ? `Recebe dia ${renda.dia_recebimento}` : 'Sem dia fixo'}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-green">{formatBRL(Number(renda.valor))}</span>
                <div className={ACOES_CLASS}>
                  <Button variant="icon" onClick={() => setRendaAberta({ renda })} aria-label={`Editar renda ${renda.descricao}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="icon" onClick={() => setExcluindoRenda(renda)} aria-label={`Excluir renda ${renda.descricao}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal de limite (novo/editar) */}
      <Modal
        isOpen={!!limiteAberto}
        onClose={() => setLimiteAberto(null)}
        title={limiteAberto?.orcamento ? 'Editar limite' : 'Novo limite'}
      >
        {limiteAberto && (
          <LimiteForm
            categoriaInicial={limiteAberto.categoria}
            valorInicial={limiteAberto.orcamento ? Number(limiteAberto.orcamento.valor_planejado) : null}
            categoriaFixa={limiteAberto.categoria !== ''}
            sugestoes={sugestoes}
            existentes={(orcamento.data ?? []).map((o) => o.categoria)}
            isLoading={salvarOrcamento.isPending}
            onCancel={() => setLimiteAberto(null)}
            onSubmit={handleSalvarLimite}
          />
        )}
      </Modal>

      {/* Modal de renda (nova/editar) */}
      <Modal
        isOpen={!!rendaAberta}
        onClose={() => setRendaAberta(null)}
        title={rendaAberta?.renda ? 'Editar renda' : 'Nova renda'}
      >
        {rendaAberta && (
          <RendaForm
            renda={rendaAberta.renda}
            isLoading={criarRenda.isPending || atualizarRenda.isPending}
            onCancel={() => setRendaAberta(null)}
            onSubmit={handleSalvarRenda}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!excluindoLimite}
        onClose={() => setExcluindoLimite(null)}
        onConfirm={handleExcluirLimite}
        title="Excluir limite"
        message={`Excluir o limite de "${excluindoLimite?.categoria}"? Os gastos da categoria continuam registrados.`}
        confirmLabel="Excluir"
        isLoading={excluirOrcamento.isPending}
      />

      <ConfirmarExclusao
        isOpen={!!excluindoRenda}
        onClose={() => setExcluindoRenda(null)}
        onConfirm={handleExcluirRenda}
        titulo="Excluir renda"
        detalhe={excluindoRenda ? detalheExclusaoRenda(excluindoRenda.descricao) : undefined}
        isLoading={excluirRenda.isPending}
      />
    </div>
  );
}

// --- Linha limite × gasto ---
function LinhaLimite({ linha, onDefinir, onExcluir }: { linha: LinhaOrcamento; onDefinir: () => void; onExcluir: () => void }) {
  const ui = linha.situacao ? SITUACAO_LIMITE_UI[linha.situacao] : null;
  const restante = linha.limite === null ? null : linha.limite - linha.gasto;
  const progresso = linha.pct ?? (linha.gasto > 0 ? 1 : 0);

  return (
    <li className="group space-y-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text">
            <span className="min-w-0 max-w-full truncate">{linha.categoria}</span>
            {ui ? (
              <Badge color={ui.color} className="shrink-0 whitespace-nowrap">{ui.label}</Badge>
            ) : (
              <Badge color="purple" className="shrink-0 whitespace-nowrap">Sem limite</Badge>
            )}
          </p>
          <p className="text-xs text-muted">
            {linha.limite === null
              ? `Gasto ${formatBRL(linha.gasto)} no mês`
              : `Gasto ${formatBRL(linha.gasto)} de ${formatBRL(linha.limite)}`}
          </p>
        </div>
        {linha.orcamento ? (
          <div className={ACOES_CLASS}>
            <Button variant="icon" onClick={onDefinir} aria-label={`Editar limite de ${linha.categoria}`}>
              <Pencil size={14} />
            </Button>
            <Button variant="icon" onClick={onExcluir} aria-label={`Excluir limite de ${linha.categoria}`}>
              <Trash2 size={14} />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="shrink-0" onClick={onDefinir} aria-label={`Definir limite de ${linha.categoria}`}>
            Definir limite
          </Button>
        )}
      </div>
      {linha.situacao && (
        <>
          <ProgressBar
            value={Math.round(Math.min(progresso, 1) * 100)}
            max={100}
            color={BARRA_COR[linha.situacao]}
            label={`${Math.round(progresso * 100)}% do limite`}
          />
          {restante !== null && (
            <p className={restante < 0 ? 'text-xs font-medium text-red' : 'text-xs text-muted'}>
              {restante < 0 ? `Passou ${formatBRL(-restante)} do limite` : `Restam ${formatBRL(restante)}`}
            </p>
          )}
        </>
      )}
    </li>
  );
}
