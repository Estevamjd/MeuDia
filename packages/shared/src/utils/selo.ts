import { SELO_LIMITES, type Selo } from '../types/financas';

export interface SeloInput {
  rendaPrevista: number;
  contasMes: number;
  /** "No fim do mês sobra" (`sobraDoMes(...).valor`): a única sobra do app. */
  sobraDoMes: number;
  pctComprometida: number | null;
  temContaVencida: boolean;
}
export function calcularSelo(input: SeloInput, limites: { NO_CONTROLE_MAX: number; ATENCAO_MAX: number } = SELO_LIMITES): Selo | null {
  if (input.rendaPrevista === 0 && input.contasMes === 0) return null;
  if (input.sobraDoMes < 0 || (input.pctComprometida ?? 0) > limites.ATENCAO_MAX || (input.rendaPrevista === 0 && input.contasMes > 0)) return 'Apertado';
  if ((input.pctComprometida ?? 0) > limites.NO_CONTROLE_MAX || input.temContaVencida) return 'Atenção';
  return 'No controle';
}
