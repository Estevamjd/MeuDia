import { regrasTreino } from '../treino.rules';
import { baseContexto } from './helpers';

function findRegra(id: string) {
  const regra = regrasTreino.find((r) => r.id === id);
  if (!regra) throw new Error(`Regra ${id} nao encontrada`);
  return regra;
}

describe('regrasTreino', () => {
  describe('treino_hoje_pendente', () => {
    const regra = findRegra('treino_hoje_pendente');

    it('deve disparar quando tem treino hoje, nao concluido e antes das 22h', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: false,
        horaAtual: 15,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando treino ja concluido', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: true,
        horaAtual: 15,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando nao tem treino hoje', () => {
      const ctx = baseContexto({
        temTreinoHoje: false,
        treinoHojeConcluido: false,
        horaAtual: 15,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar apos as 22h', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: false,
        horaAtual: 22,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve incluir nome do treino na mensagem quando disponivel', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: false,
        horaAtual: 15,
        nomeTreino: 'Peito e Tríceps',
        ultimaCarga: 80,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('Peito e Tríceps');
      expect(msg).toContain('80kg');
    });

    it('deve usar mensagem generica quando nomeTreino e null', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: false,
        horaAtual: 15,
        nomeTreino: null,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('Você tem treino hoje');
    });

    it('nao deve mencionar carga quando ultimaCarga e null', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        nomeTreino: 'Costas',
        ultimaCarga: null,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('Costas');
      expect(msg).not.toContain('kg');
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });
  });

  describe('treino_hoje_concluido', () => {
    const regra = findRegra('treino_hoje_concluido');

    it('deve disparar quando tem treino hoje e esta concluido', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: true,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando treino nao concluido', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinoHojeConcluido: false,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando nao tem treino hoje', () => {
      const ctx = baseContexto({
        temTreinoHoje: false,
        treinoHojeConcluido: true,
      });
      // temTreinoHoje && treinoHojeConcluido => false && true => false
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve conter mensagem de parabens', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('concluído');
    });
  });

  describe('faltou_treino_ontem', () => {
    const regra = findRegra('faltou_treino_ontem');

    it('deve disparar quando faltou ontem e treino hoje nao concluido', () => {
      const ctx = baseContexto({
        faltouTreinoOntem: true,
        treinoHojeConcluido: false,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando nao faltou ontem', () => {
      const ctx = baseContexto({
        faltouTreinoOntem: false,
        treinoHojeConcluido: false,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando treino hoje ja concluido (compensou)', () => {
      const ctx = baseContexto({
        faltouTreinoOntem: true,
        treinoHojeConcluido: true,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });

    it('deve mencionar compensar na mensagem', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('compensar');
    });
  });

  describe('treinos_semana_baixo', () => {
    const regra = findRegra('treinos_semana_baixo');

    it('deve disparar quando diaSemana >= 4 e treinos abaixo de 40% da meta', () => {
      const ctx = baseContexto({
        diaSemana: 5, // sexta
        treinosNaSemana: 1,
        metaTreinosSemana: 5, // 40% de 5 = 2, 1 < 2
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar na quinta (diaSemana=4)', () => {
      const ctx = baseContexto({
        diaSemana: 4,
        treinosNaSemana: 0,
        metaTreinosSemana: 5,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar antes de quinta (diaSemana < 4)', () => {
      const ctx = baseContexto({
        diaSemana: 3, // quarta
        treinosNaSemana: 0,
        metaTreinosSemana: 5,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando treinos >= 40% da meta', () => {
      const ctx = baseContexto({
        diaSemana: 5,
        treinosNaSemana: 2,
        metaTreinosSemana: 5, // 40% de 5 = 2, 2 < 2 => false
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade alerta', () => {
      expect(regra.prioridade).toBe('alerta');
    });

    it('deve mencionar o dia da semana na mensagem (quinta)', () => {
      const ctx = baseContexto({ diaSemana: 4, treinosNaSemana: 1 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('quinta');
    });

    it('deve mencionar o dia da semana na mensagem (sexta)', () => {
      const ctx = baseContexto({ diaSemana: 5, treinosNaSemana: 0 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('sexta');
    });

    it('deve mencionar fim de semana para diaSemana >= 6', () => {
      const ctx = baseContexto({ diaSemana: 6, treinosNaSemana: 0 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('fim de semana');
    });

    it('deve usar plural correto para 1 treino', () => {
      const ctx = baseContexto({ diaSemana: 5, treinosNaSemana: 1 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('1 treino');
      expect(msg).not.toContain('1 treinos');
    });

    it('deve usar plural correto para 0 treinos', () => {
      const ctx = baseContexto({ diaSemana: 5, treinosNaSemana: 0 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('0 treinos');
    });
  });

  describe('descanso_merecido', () => {
    const regra = findRegra('descanso_merecido');

    it('deve disparar quando nao tem treino hoje e >= 3 treinos na semana', () => {
      const ctx = baseContexto({
        temTreinoHoje: false,
        treinosNaSemana: 3,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 5 treinos na semana', () => {
      const ctx = baseContexto({
        temTreinoHoje: false,
        treinosNaSemana: 5,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando tem treino hoje', () => {
      const ctx = baseContexto({
        temTreinoHoje: true,
        treinosNaSemana: 3,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com menos de 3 treinos na semana', () => {
      const ctx = baseContexto({
        temTreinoHoje: false,
        treinosNaSemana: 2,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve mencionar descanso na mensagem', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('descanso');
    });
  });

  describe('streak_motivacional', () => {
    const regra = findRegra('streak_motivacional');

    it('deve disparar com streak de 7', () => {
      const ctx = baseContexto({ streakAtual: 7 });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com streak de 14', () => {
      const ctx = baseContexto({ streakAtual: 14 });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com streak de 21', () => {
      const ctx = baseContexto({ streakAtual: 21 });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar com streak de 6', () => {
      const ctx = baseContexto({ streakAtual: 6 });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com streak de 8 (nao multiplo de 7)', () => {
      const ctx = baseContexto({ streakAtual: 8 });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar com streak de 0', () => {
      const ctx = baseContexto({ streakAtual: 0 });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve incluir o numero do streak na mensagem', () => {
      const ctx = baseContexto({ streakAtual: 14 });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('14');
    });
  });
});
