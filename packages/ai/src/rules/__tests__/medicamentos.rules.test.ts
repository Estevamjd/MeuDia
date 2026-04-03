import { regrasMedicamentos } from '../medicamentos.rules';
import { baseContexto } from './helpers';

function findRegra(id: string) {
  const regra = regrasMedicamentos.find((r) => r.id === id);
  if (!regra) throw new Error(`Regra ${id} nao encontrada`);
  return regra;
}

describe('regrasMedicamentos', () => {
  describe('medicamentos_pendentes', () => {
    const regra = findRegra('medicamentos_pendentes');

    it('deve disparar quando medicamentosPendentes > 0', () => {
      const ctx = baseContexto({
        medicamentosPendentes: 1,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com varios medicamentos pendentes', () => {
      const ctx = baseContexto({
        medicamentosPendentes: 5,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar com 0 pendentes', () => {
      const ctx = baseContexto({
        medicamentosPendentes: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade aviso', () => {
      expect(regra.prioridade).toBe('aviso');
    });

    it('deve usar singular para 1 medicamento', () => {
      const ctx = baseContexto({
        medicamentosPendentes: 1,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('1 medicamento pendente');
    });

    it('deve usar plural para mais de 1 medicamento', () => {
      const ctx = baseContexto({
        medicamentosPendentes: 3,
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('3 medicamentos pendentes');
    });
  });

  describe('medicamentos_todos_tomados', () => {
    const regra = findRegra('medicamentos_todos_tomados');

    it('deve disparar quando tomados > 0 e pendentes = 0', () => {
      const ctx = baseContexto({
        medicamentosTomados: 3,
        medicamentosPendentes: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com 1 tomado e 0 pendentes', () => {
      const ctx = baseContexto({
        medicamentosTomados: 1,
        medicamentosPendentes: 0,
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando ainda ha pendentes', () => {
      const ctx = baseContexto({
        medicamentosTomados: 2,
        medicamentosPendentes: 1,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('nao deve disparar quando nenhum medicamento foi tomado (nem tem para tomar)', () => {
      const ctx = baseContexto({
        medicamentosTomados: 0,
        medicamentosPendentes: 0,
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade info', () => {
      expect(regra.prioridade).toBe('info');
    });

    it('deve mencionar que todos foram tomados', () => {
      const ctx = baseContexto();
      const msg = regra.mensagem(ctx);
      expect(msg.toLowerCase()).toContain('todos');
    });
  });

  describe('estoque_baixo', () => {
    const regra = findRegra('estoque_baixo');

    it('deve disparar quando ha medicamentos com estoque baixo', () => {
      const ctx = baseContexto({
        estoqueBaixo: ['Vitamina D'],
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('deve disparar com varios medicamentos em estoque baixo', () => {
      const ctx = baseContexto({
        estoqueBaixo: ['Vitamina D', 'Omega 3', 'Creatina'],
      });
      expect(regra.condicao(ctx)).toBe(true);
    });

    it('nao deve disparar quando estoqueBaixo esta vazio', () => {
      const ctx = baseContexto({
        estoqueBaixo: [],
      });
      expect(regra.condicao(ctx)).toBe(false);
    });

    it('deve ter prioridade alerta', () => {
      expect(regra.prioridade).toBe('alerta');
    });

    it('deve usar singular para 1 medicamento com estoque baixo', () => {
      const ctx = baseContexto({
        estoqueBaixo: ['Vitamina D'],
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('Vitamina D');
      expect(msg).toContain('Estoque baixo');
    });

    it('deve listar todos os medicamentos quando varios em estoque baixo', () => {
      const ctx = baseContexto({
        estoqueBaixo: ['Vitamina D', 'Omega 3'],
      });
      const msg = regra.mensagem(ctx);
      expect(msg).toContain('Vitamina D');
      expect(msg).toContain('Omega 3');
      expect(msg).toContain('2 medicamentos');
    });
  });
});
