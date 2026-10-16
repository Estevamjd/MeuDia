import { contaPagarInsertSchema } from '@meudia/api';
import type { ContaPagar, ContaPagarInsert, Recorrencia } from '@meudia/shared';

/** Estado do formulário de conta (strings, como vêm dos inputs). */
export interface ContaForm {
  descricao: string;
  valor: string;
  categoria: string;
  recorrencia: Recorrencia;
  dia: string;
  mes: string;
  data: string;
}

export const CONTA_FORM_VAZIO: ContaForm = {
  descricao: '',
  valor: '',
  categoria: 'Contas',
  recorrencia: 'mensal',
  dia: '',
  mes: '',
  data: '',
};

export function contaParaForm(conta: ContaPagar): ContaForm {
  return {
    descricao: conta.descricao,
    valor: String(conta.valor),
    categoria: conta.categoria,
    recorrencia: conta.recorrencia,
    dia: conta.dia_vencimento?.toString() ?? '',
    mes: conta.mes_vencimento?.toString() ?? '',
    data: conta.data_vencimento ?? '',
  };
}

const inteiro = (s: string) => (s.trim() === '' ? null : Number(s));

/**
 * Monta o payload com só os campos de vencimento da recorrência (os demais `null`)
 * e valida com o mesmo schema do backend.
 */
export function montarContaInsert(form: ContaForm): { ok: true; data: ContaPagarInsert } | { ok: false; erro: string } {
  const valor = Math.round(Number(form.valor.replace(',', '.')) * 100) / 100;
  const payload: ContaPagarInsert = {
    descricao: form.descricao.trim(),
    categoria: form.categoria.trim() || 'Contas',
    valor,
    recorrencia: form.recorrencia,
    dia_vencimento: form.recorrencia === 'unica' ? null : inteiro(form.dia),
    mes_vencimento: form.recorrencia === 'anual' ? inteiro(form.mes) : null,
    data_vencimento: form.recorrencia === 'unica' ? form.data || null : null,
  };
  const parsed = contaPagarInsertSchema.safeParse(payload);
  if (parsed.success) return { ok: true, data: payload };
  const campo = parsed.error.issues[0]?.path[0];
  const erro =
    campo === 'descricao' ? 'Informe o nome da conta.'
    : campo === 'valor' ? 'Informe um valor maior que zero.'
    : campo === 'categoria' ? 'Categoria inválida.'
    : form.recorrencia === 'mensal' ? 'Informe o dia do vencimento (1 a 31).'
    : form.recorrencia === 'anual' ? 'Informe o dia (1 a 31) e o mês (1 a 12) do vencimento.'
    : 'Informe a data do vencimento.';
  return { ok: false, erro };
}

export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  unica: 'Única',
};

/** "Todo dia 10", "Todo 10/03", "Em 2026-11-05" → texto curto pt-BR. */
export function descreverVencimento(conta: Pick<ContaPagar, 'recorrencia' | 'dia_vencimento' | 'mes_vencimento' | 'data_vencimento'>): string {
  if (conta.recorrencia === 'mensal') return `Todo dia ${conta.dia_vencimento}`;
  if (conta.recorrencia === 'anual') {
    return `Todo ano em ${String(conta.dia_vencimento).padStart(2, '0')}/${String(conta.mes_vencimento).padStart(2, '0')}`;
  }
  const [ano, mes, dia] = (conta.data_vencimento ?? '').split('-');
  return `Em ${dia}/${mes}/${ano}`;
}
