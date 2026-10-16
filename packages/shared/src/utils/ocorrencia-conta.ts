import type { ContaPagar } from '../types/financas';
import { competenciaDe, hojeSP, vencimentoNoMes } from './vencimentos';

export function ocorrenciaDaConta(conta: ContaPagar, competencia: string): { vencimento: string } | null {
  if (!conta.ativo) return null;
  if (conta.recorrencia === 'unica') {
    return conta.data_vencimento && competenciaDe(conta.data_vencimento) === competencia
      ? { vencimento: conta.data_vencimento } : null;
  }
  if (conta.created_at && competencia < competenciaDe(hojeSP(new Date(conta.created_at)))) return null;
  const [ano, mes] = competencia.split('-').map(Number) as [number, number];
  if (conta.recorrencia === 'anual' && mes !== conta.mes_vencimento) return null;
  if (conta.dia_vencimento == null) return null;
  return { vencimento: vencimentoNoMes(conta.dia_vencimento, ano, mes) };
}
