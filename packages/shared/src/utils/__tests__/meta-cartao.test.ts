import { describe, expect, it } from 'vitest';
import { metaDoCartao, progressoMeta, type MetaParaCartao } from '../metas';

const meta = (p: Partial<MetaParaCartao> & { id: string }): MetaParaCartao => ({
  nome: p.id, valor_alvo: 1000, valor_guardado: 0, data_limite: null, criado_em: '2026-09-01T12:00:00Z', ...p,
});

describe('metaDoCartao (qual meta aparece no cartão da Início)', () => {
  it('sem metas não mostra nada', () => {
    expect(metaDoCartao([])).toBeNull();
  });
  it('prefere a não alcançada de prazo mais próximo', () => {
    const r = metaDoCartao([
      meta({ id: 'longe', data_limite: '2027-12-01' }),
      meta({ id: 'perto', data_limite: '2027-01-15' }),
      meta({ id: 'feita', data_limite: '2026-12-01', valor_guardado: 1000 }),
      meta({ id: 'sem-prazo', criado_em: '2026-11-10T12:00:00Z' }),
    ]);
    expect(r?.id).toBe('perto');
  });
  it('sem prazo em nenhuma aberta: a mais recente', () => {
    const r = metaDoCartao([meta({ id: 'velha' }), meta({ id: 'nova', criado_em: '2026-11-01T00:00:00Z' })]);
    expect(r?.id).toBe('nova');
  });
  it('todas alcançadas: a mais recente (para comemorar)', () => {
    const r = metaDoCartao([meta({ id: 'a', valor_guardado: 1000 }), meta({ id: 'b', valor_guardado: 1200, criado_em: '2026-10-01T00:00:00Z' })]);
    expect(r?.id).toBe('b');
  });
});

describe('progressoMeta (barra, falta, marca "hoje" e ritmo)', () => {
  it('Celular novo: R$ 840 de R$ 2.000, criado 01/09, prazo 31/03/2027, hoje 19/11 → 42%, faltam 1.160, à frente', () => {
    const p = progressoMeta({ valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00Z' }, '2026-11-19');
    expect(p).toEqual({ pct: 42, falta: 1160, alcancada: false, pctEsperado: 37, ritmo: 'a_frente', diasAtePrazo: 132 });
  });
  it('atrás do ritmo quando guardou bem menos que o esperado', () => {
    const p = progressoMeta({ valor_alvo: 1000, valor_guardado: 100, data_limite: '2026-12-31', criado_em: '2026-09-01' }, '2026-11-19');
    expect(p.ritmo).toBe('atras');
    expect(p.pctEsperado).toBe(65); // 79 de 121 dias
  });
  it('no ritmo dentro da folga de 3 pontos', () => {
    const p = progressoMeta({ valor_alvo: 1000, valor_guardado: 630, data_limite: '2026-12-31', criado_em: '2026-09-01' }, '2026-11-19');
    expect(p.ritmo).toBe('no_ritmo');
  });
  it('sem prazo: só barra e falta, sem marca nem ritmo', () => {
    const p = progressoMeta({ valor_alvo: 300, valor_guardado: 299.99, data_limite: null, criado_em: '2026-09-01' }, '2026-11-19');
    expect(p).toEqual({ pct: 99, falta: 0.01, alcancada: false, pctEsperado: null, ritmo: null, diasAtePrazo: null });
  });
  it('alcançada mostra 100% e falta 0, mesmo guardando além do alvo', () => {
    const p = progressoMeta({ valor_alvo: 500, valor_guardado: 650, data_limite: '2026-10-01', criado_em: '2026-09-01' }, '2026-11-19');
    expect(p).toMatchObject({ pct: 100, falta: 0, alcancada: true, pctEsperado: 100, ritmo: 'a_frente', diasAtePrazo: -49 });
  });
  it('prazo antes da criação não quebra (sem marca)', () => {
    const p = progressoMeta({ valor_alvo: 500, valor_guardado: 0, data_limite: '2026-08-01', criado_em: '2026-09-01' }, '2026-11-19');
    expect(p.pctEsperado).toBeNull();
    expect(p.ritmo).toBeNull();
  });
});
