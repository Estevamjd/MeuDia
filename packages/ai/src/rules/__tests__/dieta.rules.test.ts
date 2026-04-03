import { regrasDieta } from '../dieta.rules';
import { baseContexto } from './helpers';

function findRegra(id: string) {
  const regra = regrasDieta.find((r) => r.id === id);
  if (!regra) throw new Error(`Regra ${id} nao encontrada`);
  return regra;
}

describe('regrasDieta', () => {
  describe('agua_baixa_tarde', () => {
    const regra = findRegra('agua_baixa_tarde');

    it('deve disparar quando horaAtual >= 14 e coposAgua < 50% da meta', () => {
      const ctx = baseContexto({
        horaAtual: 15,
        coposAgua: 3,
        metaAgua: 8, // 50% = 4, 3 < 4
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 0 copos as 14h', () => {
      const ctx = baseContexto({
        horaAtual: 14,
        coposAgua: 0,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes das 14h', () => {
      const ctx = baseContexto({
        horaAtual: 13,
        coposAgua: 1,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando coposAgua >= 50% da meta', () => {
      const ctx = baseContexto({
        horaAtual: 15,
        coposAgua: 4,
        metaAgua: 8, // 50% = 4, 4 < 4 => false
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });

    it('deve incluir copos e meta na mensagem', () => {
      const ctx = baseContexto({
        horaAtual: 16,
        coposAgua: 2,
        metaAgua: 8,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('2');
      expect(msg).toContain('8');
    });
  });

  describe('agua_quase_la', () => {
    const regra = findRegra('agua_quase_la');

    it('deve disparar quando coposAgua >= 75% da meta e < meta', () => {
      const ctx = baseContexto({
        coposAgua: 6,
        metaAgua: 8, // 75% = 6, 6 >= 6 && 6 < 8
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 7 de 8 copos', () => {
      const ctx = baseContexto({
        coposAgua: 7,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando < 75% da meta', () => {
      const ctx = baseContexto({
        coposAgua: 5,
        metaAgua: 8, // 75% = 6, 5 < 6
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando ja bateu a meta', () => {
      const ctx = baseContexto({
        coposAgua: 8,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando ultrapassou a meta', () => {
      const ctx = baseContexto({
        coposAgua: 10,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve informar quantos copos faltam', () => {
      const ctx = baseContexto({
        coposAgua: 6,
        metaAgua: 8,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('2'); // 8 - 6 = 2
    });
  });

  describe('agua_meta_batida', () => {
    const regra = findRegra('agua_meta_batida');

    it('deve disparar quando coposAgua >= metaAgua', () => {
      const ctx = baseContexto({
        coposAgua: 8,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar quando ultrapassou a meta', () => {
      const ctx = baseContexto({
        coposAgua: 12,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando abaixo da meta', () => {
      const ctx = baseContexto({
        coposAgua: 7,
        metaAgua: 8,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve mencionar meta batida na mensagem', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg.toLowerCase()).toContain('meta');
    });
  });

  describe('poucas_refeicoes', () => {
    const regra = findRegra('poucas_refeicoes');

    it('deve disparar quando horaAtual >= 18 e refeicoesHoje < 2', () => {
      const ctx = baseContexto({
        horaAtual: 18,
        refeicoesHoje: 1,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 0 refeicoes as 20h', () => {
      const ctx = baseContexto({
        horaAtual: 20,
        refeicoesHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes das 18h', () => {
      const ctx = baseContexto({
        horaAtual: 17,
        refeicoesHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com 2 ou mais refeicoes', () => {
      const ctx = baseContexto({
        horaAtual: 19,
        refeicoesHoje: 2,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });
  });

  describe('calorias_muito_baixas', () => {
    const regra = findRegra('calorias_muito_baixas');

    it('deve disparar quando horaAtual >= 15, calorias > 0 e < 40% da meta', () => {
      const ctx = baseContexto({
        horaAtual: 16,
        caloriasHoje: 500,
        metaCalorias: 2000, // 40% = 800, 500 < 800
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes das 15h', () => {
      const ctx = baseContexto({
        horaAtual: 14,
        caloriasHoje: 200,
        metaCalorias: 2000,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando calorias = 0 (nao registrou)', () => {
      const ctx = baseContexto({
        horaAtual: 16,
        caloriasHoje: 0,
        metaCalorias: 2000,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando calorias >= 40% da meta', () => {
      const ctx = baseContexto({
        horaAtual: 16,
        caloriasHoje: 800,
        metaCalorias: 2000, // 40% = 800, 800 < 800 => false
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });

    it('deve mencionar calorias ou refeicoes na mensagem', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg.toLowerCase()).toMatch(/caloria|refeic/i);
    });
  });
});
