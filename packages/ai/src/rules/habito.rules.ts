import type { AIRule } from './types';

export const regrasHabito: AIRule[] = [
  {
    id: 'habitos_pendentes_tarde',
    modulo: 'habitos',
    condicao: (ctx) => ctx.horaAtual >= 18 && ctx.percentualHabitosHoje < 50,
    mensagem: (ctx) =>
      `Já são ${ctx.horaAtual}h e você completou apenas ${Math.round(ctx.percentualHabitosHoje)}% dos hábitos de hoje. Ainda dá tempo!`,
    prioridade: 'aviso',
  },
  {
    id: 'habitos_quase_la',
    modulo: 'habitos',
    condicao: (ctx) =>
      ctx.percentualHabitosHoje >= 60 &&
      ctx.percentualHabitosHoje < 100 &&
      ctx.habitosPendentes.length <= 2,
    mensagem: (ctx) =>
      `Falta${ctx.habitosPendentes.length === 1 ? '' : 'm'} apenas ${ctx.habitosPendentes.length} hábito${ctx.habitosPendentes.length === 1 ? '' : 's'}: ${ctx.habitosPendentes.join(', ')}. Conclua para ganhar pontos!`,
    prioridade: 'info',
  },
  {
    id: 'habitos_100_hoje',
    modulo: 'habitos',
    condicao: (ctx) => ctx.percentualHabitosHoje === 100,
    mensagem: () =>
      'Todos os hábitos de hoje concluídos! Excelente disciplina. +20 pontos de hábitos.',
    prioridade: 'info',
  },
  {
    id: 'habitos_manha',
    modulo: 'habitos',
    condicao: (ctx) =>
      ctx.horaAtual >= 7 && ctx.horaAtual <= 10 && ctx.percentualHabitosHoje === 0,
    mensagem: () =>
      'Bom dia! Que tal começar o dia completando seus hábitos matinais?',
    prioridade: 'info',
  },
  {
    id: 'score_baixo_consecutivo',
    modulo: 'geral',
    condicao: (ctx) => ctx.scoreMedio7dias < 50 && ctx.scoreHoje < 40,
    mensagem: () =>
      'Seu score está abaixo de 50 nos últimos dias. Foque em completar pelo menos os hábitos e beber água — pequenos passos fazem diferença!',
    prioridade: 'alerta',
  },
  {
    id: 'score_alto',
    modulo: 'geral',
    condicao: (ctx) => ctx.scoreMedio7dias >= 80,
    mensagem: (ctx) =>
      `Média de ${Math.round(ctx.scoreMedio7dias)} pontos nos últimos 7 dias! Você está arrasando. Continue nesse ritmo!`,
    prioridade: 'info',
  },
];
