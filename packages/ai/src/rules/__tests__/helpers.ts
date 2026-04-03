import type { AIContexto } from '../types';

export function baseContexto(overrides: Partial<AIContexto> = {}): AIContexto {
  return {
    // Treinos
    temTreinoHoje: false,
    treinoHojeConcluido: false,
    nomeTreino: null,
    ultimaCarga: null,
    faltouTreinoOntem: false,
    treinosNaSemana: 2,
    metaTreinosSemana: 5,

    // Habitos
    percentualHabitosHoje: 50,
    habitosPendentes: [],
    streakAtual: 0,

    // Score
    scoreHoje: 60,
    scoreMedio7dias: 60,

    // Dieta
    coposAgua: 4,
    metaAgua: 8,
    caloriasHoje: 1500,
    metaCalorias: 2000,
    refeicoesHoje: 3,

    // Medicamentos
    medicamentosPendentes: 0,
    medicamentosTomados: 0,
    estoqueBaixo: [],

    // Agenda
    compromissosHoje: 0,
    compromissosPendentes: 0,

    // Financas
    saldoMes: 1000,
    despesasMes: 500,

    // Temporal
    horaAtual: 12,
    diaSemana: 3, // quarta

    ...overrides,
  };
}
