import type {
  Competencia,
  OcorrenciaConta,
  OrcamentoCategoria,
  Selo,
  SituacaoOcorrencia,
  Transacao,
} from '@meudia/shared';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const RE_COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export function isCompetencia(valor: string | null | undefined): valor is Competencia {
  return !!valor && RE_COMPETENCIA.test(valor);
}

export function partesCompetencia(competencia: Competencia): { ano: number; mes: number } {
  const [ano, mes] = competencia.split('-').map(Number);
  if (!isCompetencia(competencia) || ano === undefined || mes === undefined || !Number.isInteger(ano) ||
      !Number.isInteger(mes) || ano < 0 || ano > 9999 || mes < 1 || mes > 12) {
    throw new Error('Competência inválida');
  }
  return { ano, mes };
}

export function montarCompetencia(ano: number, mes: number): Competencia {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

/** Soma `delta` meses (negativo volta), com virada de ano. */
export function deslocarCompetencia(competencia: Competencia, delta: number): Competencia {
  const { ano, mes } = partesCompetencia(competencia);
  const total = ano * 12 + (mes - 1) + delta;
  return montarCompetencia(Math.floor(total / 12), (total % 12) + 1);
}

export function rotuloCompetencia(competencia: Competencia): string {
  const { ano, mes } = partesCompetencia(competencia);
  return `${MESES[mes - 1]} ${ano}`;
}

export const formatBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

/** Máscara de moeda: só dígitos, lidos como centavos ("480000" → R$ 4.800,00). Até 99.999.999,99. */
export function mascaraBRL(texto: string): { digitos: string; exibicao: string; valor: number } {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
  const valor = digitos ? Number(digitos) / 100 : 0;
  return { digitos, exibicao: digitos ? formatBRL(valor) : '', valor };
}

/** Selo da sobra prevista no orçamento: zero não é "positiva". */
export function tagSobraPrevista(sobra: number): { text: string; color: 'teal' | 'red' | 'neutral' } {
  if (sobra > 0) return { text: 'positiva', color: 'teal' };
  if (sobra < 0) return { text: 'negativa', color: 'red' };
  return { text: 'zerada', color: 'neutral' };
}

/** Fração (0.45) → "45%"; `null` → "—". */
export function formatPct(fracao: number | null): string {
  if (fracao === null || !Number.isFinite(fracao)) return '—';
  return `${Math.round(fracao * 100)}%`;
}

/** `yyyy-MM-dd` → `dd/MM` sem passar por Date (evita fuso). */
export function formatDiaMes(dataISO: string): string {
  const [, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
}

export const SITUACAO_UI: Record<SituacaoOcorrencia, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  paga: { label: 'Paga', color: 'green' },
  pendente: { label: 'Pendente', color: 'yellow' },
  vencida: { label: 'Vencida', color: 'red' },
};

export const SELO_UI: Record<Selo, { color: 'green' | 'yellow' | 'red'; descricao: string }> = {
  'No controle': { color: 'green', descricao: 'Suas contas cabem com folga na renda do mês.' },
  Atenção: { color: 'yellow', descricao: 'Mais de 70% da renda comprometida ou alguma conta vencida.' },
  Apertado: { color: 'red', descricao: 'As contas passam de 90% da renda ou a sobra prevista é negativa.' },
};

const ORDEM_SITUACAO: Record<SituacaoOcorrencia, number> = { vencida: 0, pendente: 1, paga: 2 };

/** Vencidas primeiro, depois pendentes e pagas; dentro de cada grupo, por vencimento. */
export function ordenarOcorrencias(ocorrencias: readonly OcorrenciaConta[]): OcorrenciaConta[] {
  return [...ocorrencias].sort(
    (a, b) =>
      ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.vencimento.localeCompare(b.vencimento),
  );
}

function codigoErro(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return undefined;
}

/** 409 `COMPETENCIA_JA_PAGA` (pago em outra aba/aparelho ou toque duplo). */
export function isCompetenciaJaPaga(error: unknown): boolean {
  return codigoErro(error) === 'COMPETENCIA_JA_PAGA';
}

export function mensagemErroPagamento(error: unknown): string {
  switch (codigoErro(error)) {
    case 'COMPETENCIA_JA_PAGA':
      return 'Esta conta já está paga neste mês.';
    case 'NOT_FOUND':
      return 'Conta ou pagamento não encontrado. Atualize a página.';
    case 'VALIDATION_ERROR':
      return 'Este mês não é válido para esta conta.';
    default:
      return 'Não foi possível salvar. Tente de novo.';
  }
}

/**
 * Comparativo com o mês anterior: "R$ 120,00 a menos que em setembro".
 * `null` quando não mudou nada (a home oculta o comparativo).
 */
export function textoDelta(
  delta: { absoluto: number; percentual: number | null },
  referencia = 'no mês anterior',
): string | null {
  if (delta.absoluto === 0) return null;
  return `${formatBRL(Math.abs(delta.absoluto))} a ${delta.absoluto > 0 ? 'mais' : 'menos'} que ${referencia}`;
}

/** Valor com sinal "−" (U+2212) quando negativo — nunca só a cor indica o sinal. */
export function formatBRLSinal(valor: number): string {
  return valor < 0 ? `−${formatBRL(Math.abs(valor))}` : formatBRL(valor);
}

/** "em setembro" para a competência anterior à informada. */
export function referenciaMesAnterior(competencia: Competencia): string {
  const { mes } = partesCompetencia(deslocarCompetencia(competencia, -1));
  return `em ${MESES[mes - 1]!.toLowerCase()}`;
}

/** Dias corridos de `hojeISO` até `dataISO` (ambos `yyyy-MM-dd`, sem fuso). */
export function diasAte(dataISO: string, hojeISO: string): number {
  const utc = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a!, m! - 1, d!);
  };
  return Math.round((utc(dataISO) - utc(hojeISO)) / 86_400_000);
}

/** "vence hoje", "vence amanhã", "vence em 3 dias", "venceu ontem", "venceu há 4 dias". */
export function textoVencimento(vencimentoISO: string, hojeISO: string): string {
  const dias = diasAte(vencimentoISO, hojeISO);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

export type SituacaoLimite = 'dentro' | 'perto' | 'acima';

/** A partir de 80% do limite a categoria fica "perto do limite". */
export const LIMITE_ALERTA = 0.8;

export const SITUACAO_LIMITE_UI: Record<SituacaoLimite, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  dentro: { label: 'Dentro', color: 'green' },
  perto: { label: 'Perto do limite', color: 'yellow' },
  acima: { label: 'Acima do limite', color: 'red' },
};

export interface LinhaOrcamento {
  categoria: string;
  /** `null` = categoria com gasto no mês e sem limite cadastrado. */
  orcamento: OrcamentoCategoria | null;
  limite: number | null;
  gasto: number;
  /** Fração gasto/limite; `null` sem limite ou com limite 0. */
  pct: number | null;
  situacao: SituacaoLimite | null;
}

export function situacaoLimite(gasto: number, limite: number): SituacaoLimite {
  if (gasto > limite) return 'acima';
  if (limite > 0 && gasto / limite >= LIMITE_ALERTA) return 'perto';
  return 'dentro';
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Limite × gasto por categoria. O gasto soma as despesas do mês da mesma
 * categoria (match exato, como em `resumoFinanceiroMes`). Primeiro as categorias
 * com limite (mais comprometidas no topo), depois as com gasto e sem limite.
 */
export function linhasOrcamento(
  orcamento: readonly OrcamentoCategoria[],
  transacoes: readonly Transacao[],
): LinhaOrcamento[] {
  const gastos = new Map<string, number>();
  for (const t of transacoes) {
    if (t.tipo !== 'despesa') continue;
    gastos.set(t.categoria, (gastos.get(t.categoria) ?? 0) + Number(t.valor));
  }

  const comLimite = orcamento
    .map((o): LinhaOrcamento => {
      const limite = Number(o.valor_planejado);
      const gasto = centavos(gastos.get(o.categoria) ?? 0);
      return {
        categoria: o.categoria,
        orcamento: o,
        limite,
        gasto,
        pct: limite > 0 ? gasto / limite : null,
        situacao: situacaoLimite(gasto, limite),
      };
    })
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.categoria.localeCompare(b.categoria));

  const categoriasComLimite = new Set(orcamento.map((o) => o.categoria));
  const semLimite = [...gastos.entries()]
    .filter(([categoria]) => !categoriasComLimite.has(categoria))
    .map(([categoria, gasto]): LinhaOrcamento => ({
      categoria,
      orcamento: null,
      limite: null,
      gasto: centavos(gasto),
      pct: null,
      situacao: null,
    }))
    .sort((a, b) => b.gasto - a.gasto || a.categoria.localeCompare(b.categoria));

  return [...comLimite, ...semLimite];
}

/** Texto de input numérico → reais com 2 casas; `null` se vazio, inválido, ≤ 0 ou acima do máximo do validator. */
export function parseValorPositivo(texto: string): number | null {
  const valor = parseValorNaoNegativo(texto);
  return valor !== null && valor > 0 ? valor : null;
}

/** Igual a `parseValorPositivo`, mas aceita 0 (limite de orçamento: validator `nonnegative`). */
export function parseValorNaoNegativo(texto: string): number | null {
  if (!texto.trim()) return null;
  const valor = Number(texto.replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0 || valor > 99999999.99) return null;
  return centavos(valor) + 0; // `+ 0` normaliza -0 (ex.: "-0")
}
