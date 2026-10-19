import { describe, it, expect } from 'vitest';
import { calcularSelo } from '../selo';
import { SELO_LIMITES } from '../../types/financas';
const base = { rendaPrevista: 100, contasMes: 70, sobraDoMes: 30, pctComprometida: 0.7, temContaVencida: false };
describe('calcularSelo', () => {
  it.each([[0.7, 'No controle'], [0.7001, 'Atenção'], [0.9, 'Atenção'], [0.9001, 'Apertado']])('limite %s', (pct, esperado) => {
    expect(calcularSelo({ ...base, pctComprometida: Number(pct) })).toBe(esperado);
  });
  it('constantes, sobra negativa, vencida, renda zero e ausência de dados', () => {
    expect(SELO_LIMITES).toEqual({ NO_CONTROLE_MAX: 0.7, ATENCAO_MAX: 0.9 });
    expect(calcularSelo({ ...base, sobraDoMes: -0.01 })).toBe('Apertado');
    expect(calcularSelo({ ...base, temContaVencida: true })).toBe('Atenção');
    expect(calcularSelo({ ...base, rendaPrevista: 0, pctComprometida: null })).toBe('Apertado');
    expect(calcularSelo({ ...base, rendaPrevista: 0, contasMes: 0, pctComprometida: null })).toBeNull();
    expect(calcularSelo(base, { NO_CONTROLE_MAX: 0.6, ATENCAO_MAX: 0.8 })).toBe('Atenção');
  });
});
