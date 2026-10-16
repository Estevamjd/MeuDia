import { describe, expect, it } from 'vitest';
import type { ContaPagar, OcorrenciaConta, SituacaoOcorrencia } from '@meudia/shared';
import { isVencendoEstaSemana, situacaoPorAssinatura } from '../assinaturas';

describe('isVencendoEstaSemana', () => {
  it('inclui a que vence hoje', () => {
    expect(isVencendoEstaSemana(16, '2026-10-16')).toBe(true);
  });

  it('inclui até 7 dias e exclui o 8º', () => {
    expect(isVencendoEstaSemana(23, '2026-10-16')).toBe(true);
    expect(isVencendoEstaSemana(24, '2026-10-16')).toBe(false);
  });

  it('considera a virada do mês', () => {
    expect(isVencendoEstaSemana(2, '2026-10-28')).toBe(true);
    expect(isVencendoEstaSemana(10, '2026-10-28')).toBe(false);
  });

  it('considera a virada do ano', () => {
    expect(isVencendoEstaSemana(3, '2026-12-29')).toBe(true);
  });

  it('dia 31 em fevereiro vence no último dia', () => {
    expect(isVencendoEstaSemana(31, '2027-02-25')).toBe(true);
  });

  it('dia que já passou no mês não conta como vencendo', () => {
    expect(isVencendoEstaSemana(15, '2026-10-16')).toBe(false);
  });
});

function ocorrencia(assinaturaId: string | null, situacao: SituacaoOcorrencia): OcorrenciaConta {
  return {
    conta: { id: `c-${assinaturaId ?? 'avulsa'}`, assinatura_id: assinaturaId } as ContaPagar,
    competencia: '2026-10',
    vencimento: '2026-10-10',
    situacao,
    pagamento: null,
  };
}

describe('situacaoPorAssinatura', () => {
  it('mapeia a situação da conta espelhada e ignora contas sem assinatura', () => {
    const mapa = situacaoPorAssinatura([
      ocorrencia('a1', 'paga'),
      ocorrencia('a2', 'vencida'),
      ocorrencia(null, 'pendente'),
    ]);
    expect(mapa.get('a1')).toBe('paga');
    expect(mapa.get('a2')).toBe('vencida');
    expect(mapa.size).toBe(2);
  });
});
