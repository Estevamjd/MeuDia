import { describe, expect, it } from 'vitest';
import { ritmoDiarioDoMes } from '@meudia/shared';
import { EXPLICACOES, contaDoRitmo } from '../explicacoes';

const n = (s: string) => s.replace(/\s/g, ' ');
const linha = (sobra: number, hoje: string, escondido = false, mes = '2026-11') => {
  const r = contaDoRitmo(ritmoDiarioDoMes(mes, sobra, hoje), sobra, escondido);
  return { ...r, texto: n(r.texto) };
};

describe('contaDoRitmo: a linha sob o "Pode gastar por dia"', () => {
  it('normal: Deve sobrar ÷ dias que faltam contando hoje (o print: 2.090 ÷ 11 = 190)', () => {
    expect(linha(2090, '2026-11-20')).toEqual({ texto: 'R$ 2.090,00 que sobram ÷ 11 dias', testid: 'cartao-ritmo-conta' });
    expect(ritmoDiarioDoMes('2026-11', 2090, '2026-11-20').disponivelPorDia).toBe(190);
  });

  it('último dia do mês: "só para hoje", sem "÷ 1 dias"', () => {
    expect(linha(139.1, '2026-11-30')).toEqual({ texto: 'R$ 139,10 que sobram, só para hoje', testid: 'cartao-ritmo-conta' });
  });

  it('sobra negativa: a nota do cartão (quanto passou), sem divisão', () => {
    expect(linha(-80.5, '2026-11-19')).toEqual({ texto: 'Passou R$ 80,50 do que entra', testid: 'cartao-ritmo-nota' });
    expect(linha(-80.5, '2026-11-19', true).texto).toBe('Passou do que entra');
  });

  it('sobra zero: "Sem folga este mês", sem divisão', () => {
    expect(linha(0, '2026-11-19')).toEqual({ texto: 'Sem folga este mês', testid: 'cartao-ritmo-nota' });
  });

  it('0 dias (mês já encerrado): nunca divide por zero', () => {
    const r = linha(500, '2026-12-01');
    expect(r.texto).toBe('Mês encerrado: não há dias para dividir');
    expect(r.texto).not.toContain('÷');
  });

  it('valores ocultos: a divisão aparece sem o valor', () => {
    expect(linha(2090, '2026-11-20', true).texto).not.toMatch(/\d{2},\d{2}/);
    expect(linha(2090, '2026-11-20', true).texto).toContain('÷ 11 dias');
  });
});

describe('EXPLICACOES', () => {
  it('textos curtos (até 2 frases e 240 caracteres) e rótulo não vazio', () => {
    for (const [chave, { rotulo, texto }] of Object.entries(EXPLICACOES)) {
      expect(rotulo.length, chave).toBeGreaterThan(0);
      expect(texto.length, chave).toBeLessThanOrEqual(240);
      expect(texto.split(/[.!?](?:\s|$)/).filter((f) => f.trim()).length, chave).toBeLessThanOrEqual(2);
    }
  });
});
