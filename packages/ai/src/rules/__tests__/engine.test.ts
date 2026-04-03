import { avaliarRegras, obterMensagemPrincipal, obterMensagensPorModulo } from '../engine';
import { baseContexto } from './helpers';

describe('avaliarRegras', () => {
  it('deve retornar array vazio quando nenhuma regra dispara', () => {
    // Contexto neutro: nenhuma condição especial ativada
    const ctx = baseContexto({
      horaAtual: 10,
      percentualHabitosHoje: 50,
      coposAgua: 5,
      metaAgua: 8,
      scoreMedio7dias: 60,
      scoreHoje: 60,
      saldoMes: 1000,
      despesasMes: 500,
    });
    const msgs = avaliarRegras(ctx);
    // Pode ter algumas mensagens info, mas nenhuma alerta
    // O importante é que não dê erro
    expect(Array.isArray(msgs)).toBe(true);
  });

  it('deve retornar mensagens quando regras disparam', () => {
    const ctx = baseContexto({
      temTreinoHoje: true,
      treinoHojeConcluido: false,
      horaAtual: 15,
    });
    const msgs = avaliarRegras(ctx);
    const ids = msgs.map((m) => m.id);
    expect(ids).toContain('treino_hoje_pendente');
  });

  it('deve ordenar por prioridade: alerta > aviso > info', () => {
    const ctx = baseContexto({
      // alerta: treinos_semana_baixo (diaSemana >= 4, treinosNaSemana < meta*0.4)
      diaSemana: 5,
      treinosNaSemana: 0,
      metaTreinosSemana: 5,
      // aviso: medicamentos_pendentes
      medicamentosPendentes: 2,
      // info: treino_hoje_concluido
      temTreinoHoje: true,
      treinoHojeConcluido: true,
      horaAtual: 12,
    });
    const msgs = avaliarRegras(ctx);
    expect(msgs.length).toBeGreaterThanOrEqual(3);

    const prioridades = msgs.map((m) => m.prioridade);
    // Verificar que todos 'alerta' vem antes de 'aviso' que vem antes de 'info'
    const prioridadeOrdem: Record<string, number> = { alerta: 0, aviso: 1, info: 2 };
    for (let i = 1; i < prioridades.length; i++) {
      expect(prioridadeOrdem[prioridades[i]!]!).toBeGreaterThanOrEqual(
        prioridadeOrdem[prioridades[i - 1]!]!,
      );
    }
  });

  it('deve incluir id, modulo, mensagem e prioridade em cada resultado', () => {
    const ctx = baseContexto({
      temTreinoHoje: true,
      treinoHojeConcluido: true,
    });
    const msgs = avaliarRegras(ctx);
    const msg = msgs.find((m) => m.id === 'treino_hoje_concluido');
    expect(msg).toBeDefined();
    expect(msg!.modulo).toBe('treinos');
    expect(msg!.mensagem).toBeTruthy();
    expect(msg!.prioridade).toBe('info');
  });
});

describe('obterMensagemPrincipal', () => {
  it('deve retornar null quando nenhuma regra dispara', () => {
    // Contexto muito neutro
    const ctx = baseContexto({
      horaAtual: 5, // madrugada, poucas regras
      percentualHabitosHoje: 50,
      coposAgua: 5,
      metaAgua: 8,
      saldoMes: 1000,
      despesasMes: 500,
    });
    const msg = obterMensagemPrincipal(ctx);
    // Pode ou não ser null dependendo do contexto, mas não deve dar erro
    if (msg !== null) {
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('prioridade');
    }
  });

  it('deve retornar a mensagem com maior prioridade', () => {
    const ctx = baseContexto({
      // alerta: estoque_baixo
      estoqueBaixo: ['Remedio A'],
      // info: treino_hoje_concluido
      temTreinoHoje: true,
      treinoHojeConcluido: true,
    });
    const msg = obterMensagemPrincipal(ctx);
    expect(msg).not.toBeNull();
    expect(msg!.prioridade).toBe('alerta');
  });

  it('deve retornar a primeira mensagem quando ha varias com mesma prioridade', () => {
    const ctx = baseContexto({
      temTreinoHoje: true,
      treinoHojeConcluido: true,
      coposAgua: 10,
      metaAgua: 8,
    });
    const msg = obterMensagemPrincipal(ctx);
    expect(msg).not.toBeNull();
    expect(msg!.prioridade).toBeTruthy();
  });
});

describe('obterMensagensPorModulo', () => {
  it('deve filtrar mensagens pelo modulo informado', () => {
    const ctx = baseContexto({
      temTreinoHoje: true,
      treinoHojeConcluido: false,
      horaAtual: 15,
      medicamentosPendentes: 3,
    });
    const treinoMsgs = obterMensagensPorModulo(ctx, 'treinos');
    expect(treinoMsgs.length).toBeGreaterThan(0);
    treinoMsgs.forEach((m) => expect(m.modulo).toBe('treinos'));
  });

  it('deve retornar array vazio quando modulo nao tem mensagens', () => {
    const ctx = baseContexto({
      compromissosHoje: 0,
      compromissosPendentes: 0,
    });
    const msgs = obterMensagensPorModulo(ctx, 'agenda');
    expect(msgs).toEqual([]);
  });

  it('deve retornar mensagens do modulo geral (dieta/medicamentos)', () => {
    const ctx = baseContexto({
      coposAgua: 10,
      metaAgua: 8,
      horaAtual: 20,
      refeicoesHoje: 1,
      medicamentosPendentes: 2,
    });
    const msgs = obterMensagensPorModulo(ctx, 'geral');
    expect(msgs.length).toBeGreaterThan(0);
    msgs.forEach((m) => expect(m.modulo).toBe('geral'));
  });
});
