import { verificarNotificacoes } from '../notificacao.rules';
import type { ContextoUsuario } from '@meudia/shared';

function baseContexto(overrides: Partial<ContextoUsuario> = {}): ContextoUsuario {
  return {
    userId: 'test-user',
    nome: 'João',
    objetivo: null,
    horaAtual: 14,
    diaSemana: 3,
    treinoHoje: null,
    sessoesSemana: 2,
    metaTreinosSemana: 5,
    habitosTotal: 5,
    habitosConcluidos: 2,
    habitosPendentes: ['Meditar', 'Ler', 'Água'],
    percentualHabitos: 40,
    compromissosHoje: 0,
    proximoCompromisso: null,
    saldoMes: 1000,
    despesasMes: 500,
    receitasMes: 1500,
    streakAtual: 3,
    scoreHoje: 50,
    ...overrides,
  };
}

describe('verificarNotificacoes', () => {
  it('retorna array de notificações', () => {
    const result = verificarNotificacoes(baseContexto());
    expect(result).toBeInstanceOf(Array);
  });

  it('gera alerta de hábitos pendentes à noite', () => {
    const result = verificarNotificacoes(
      baseContexto({
        horaAtual: 21,
        habitosPendentes: ['Meditar', 'Ler'],
        percentualHabitos: 40,
      }),
    );
    const habitoNotif = result.find((n) => n.modulo === 'habito');
    expect(habitoNotif).toBeDefined();
  });

  it('gera notificação de todos hábitos concluídos', () => {
    const result = verificarNotificacoes(
      baseContexto({
        habitosConcluidos: 5,
        habitosTotal: 5,
        percentualHabitos: 100,
        habitosPendentes: [],
      }),
    );
    const sucesso = result.find((n) => n.tipo === 'sucesso' && n.modulo === 'habito');
    expect(sucesso).toBeDefined();
  });

  it('gera alerta de orçamento ultrapassado', () => {
    const result = verificarNotificacoes(
      baseContexto({
        despesasMes: 2000,
        receitasMes: 1500,
        saldoMes: -500,
      }),
    );
    const finNotif = result.find((n) => n.modulo === 'financas');
    expect(finNotif).toBeDefined();
  });

  it('gera notificação de marco de streak', () => {
    const result = verificarNotificacoes(
      baseContexto({ streakAtual: 7 }),
    );
    const streakNotif = result.find((n) =>
      n.titulo?.toLowerCase().includes('streak') ||
      n.mensagem?.toLowerCase().includes('streak'),
    );
    expect(streakNotif).toBeDefined();
  });

  it('não gera notificações desnecessárias em contexto normal', () => {
    const result = verificarNotificacoes(
      baseContexto({
        horaAtual: 10,
        habitosPendentes: [],
        percentualHabitos: 100,
        habitosConcluidos: 5,
        habitosTotal: 5,
        saldoMes: 1000,
        despesasMes: 500,
        receitasMes: 1500,
        streakAtual: 2,
        sessoesSemana: 3,
      }),
    );
    // Não deve gerar alertas negativos
    const alertas = result.filter((n) => n.tipo === 'alerta');
    expect(alertas.length).toBe(0);
  });
});
