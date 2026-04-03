import { regrasHabito } from '../habito.rules';
import { baseContexto } from './helpers';

function findRegra(id: string) {
  const regra = regrasHabito.find((r) => r.id === id);
  if (!regra) throw new Error(`Regra ${id} nao encontrada`);
  return regra;
}

describe('regrasHabito', () => {
  describe('habitos_pendentes_tarde', () => {
    const regra = findRegra('habitos_pendentes_tarde');

    it('deve disparar quando horaAtual >= 18 e percentual < 50', () => {
      const ctx = baseContexto({
        horaAtual: 18,
        percentualHabitosHoje: 30,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar as 20h com 0% de habitos', () => {
      const ctx = baseContexto({
        horaAtual: 20,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes das 18h', () => {
      const ctx = baseContexto({
        horaAtual: 17,
        percentualHabitosHoje: 30,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando percentual >= 50', () => {
      const ctx = baseContexto({
        horaAtual: 19,
        percentualHabitosHoje: 50,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });

    it('deve incluir a hora e percentual na mensagem', () => {
      const ctx = baseContexto({
        horaAtual: 19,
        percentualHabitosHoje: 25,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('19h');
      expect(msg).toContain('25%');
    });
  });

  describe('habitos_quase_la', () => {
    const regra = findRegra('habitos_quase_la');

    it('deve disparar com percentual >= 60 e < 100 e ate 2 pendentes', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 80,
        habitosPendentes: ['Meditar', 'Ler'],
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 1 habito pendente', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 90,
        habitosPendentes: ['Meditar'],
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar com percentual < 60', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 50,
        habitosPendentes: ['Meditar'],
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com 100%', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 100,
        habitosPendentes: [],
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com mais de 2 pendentes', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 65,
        habitosPendentes: ['A', 'B', 'C'],
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve usar singular para 1 habito pendente', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 90,
        habitosPendentes: ['Meditar'],
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('1 hábito');
      expect(msg).toContain('Meditar');
    });

    it('deve usar plural para 2 habitos pendentes', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 80,
        habitosPendentes: ['Meditar', 'Ler'],
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('2 hábitos');
      expect(msg).toContain('Meditar');
      expect(msg).toContain('Ler');
    });
  });

  describe('habitos_100_hoje', () => {
    const regra = findRegra('habitos_100_hoje');

    it('deve disparar com 100% dos habitos', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 100,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar com 99%', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 99,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com 0%', () => {
      const ctx = baseContexto({
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve mencionar conclusao na mensagem', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('concluídos');
    });
  });

  describe('habitos_manha', () => {
    const regra = findRegra('habitos_manha');

    it('deve disparar entre 7h e 10h com 0% de habitos', () => {
      const ctx = baseContexto({
        horaAtual: 8,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar as 7h', () => {
      const ctx = baseContexto({
        horaAtual: 7,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar as 10h', () => {
      const ctx = baseContexto({
        horaAtual: 10,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes das 7h', () => {
      const ctx = baseContexto({
        horaAtual: 6,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar apos as 10h', () => {
      const ctx = baseContexto({
        horaAtual: 11,
        percentualHabitosHoje: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando ja tem progresso', () => {
      const ctx = baseContexto({
        horaAtual: 8,
        percentualHabitosHoje: 10,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });
  });

  describe('score_baixo_consecutivo', () => {
    const regra = findRegra('score_baixo_consecutivo');

    it('deve disparar quando scoreMedio7dias < 50 e scoreHoje < 40', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 40,
        scoreHoje: 30,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando scoreMedio7dias >= 50', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 50,
        scoreHoje: 30,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando scoreHoje >= 40', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 40,
        scoreHoje: 40,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade alerta', () => {
      expect(regra.prioridade).toBe('alerta');
    });

    it('deve ter modulo geral', () => {
      expect(regra.modulo).toBe('geral');
    });
  });

  describe('score_alto', () => {
    const regra = findRegra('score_alto');

    it('deve disparar quando scoreMedio7dias >= 80', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 80,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com score 95', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 95,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando scoreMedio7dias < 80', () => {
      const ctx = baseContexto({
        scoreMedio7dias: 79,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve ter modulo geral', () => {
      expect(regra.modulo).toBe('geral');
    });

    it('deve incluir a media na mensagem', () => {
      const ctx = baseContexto({ scoreMedio7dias: 85 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('85');
    });
  });
});
