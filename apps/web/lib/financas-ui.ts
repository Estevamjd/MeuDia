import type { Competencia, OcorrenciaConta, Selo, SituacaoOcorrencia } from '@meudia/shared';

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

/** Texto do comparativo com o mês anterior (`percentual` é fração ou `null` sem base). */
export function textoDelta(delta: { absoluto: number; percentual: number | null }): string {
  if (delta.absoluto === 0) return 'igual ao mês anterior';
  const sinal = delta.absoluto > 0 ? '+' : '−';
  const pct = delta.percentual === null ? '' : ` (${sinal}${Math.abs(Math.round(delta.percentual * 100))}%)`;
  return `${sinal}${formatBRL(Math.abs(delta.absoluto))}${pct} vs. mês anterior`;
}
