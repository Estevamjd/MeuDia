import type { AIRule } from './types';

export const regrasTreino: AIRule[] = [
  {
    id: 'treino_hoje_pendente',
    modulo: 'treinos',
    condicao: (ctx) => ctx.temTreinoHoje && !ctx.treinoHojeConcluido && ctx.horaAtual < 22,
    mensagem: (ctx) =>
      ctx.nomeTreino
        ? `Hoje é dia de ${ctx.nomeTreino}!${ctx.ultimaCarga ? ` Última carga no principal: ${ctx.ultimaCarga}kg.` : ''} Bora treinar 💪`
        : 'Você tem treino hoje! Não esqueça de ir à academia.',
    prioridade: 'info',
  },
  {
    id: 'treino_hoje_concluido',
    modulo: 'treinos',
    condicao: (ctx) => ctx.temTreinoHoje && ctx.treinoHojeConcluido,
    mensagem: () => 'Treino do dia concluído! Ótimo trabalho. Descanse bem para a próxima sessão.',
    prioridade: 'info',
  },
  {
    id: 'faltou_treino_ontem',
    modulo: 'treinos',
    condicao: (ctx) => ctx.faltouTreinoOntem && !ctx.treinoHojeConcluido,
    mensagem: () =>
      'Você faltou o treino ontem. Que tal compensar hoje com foco extra? Consistência é mais importante que perfeição.',
    prioridade: 'aviso',
  },
  {
    id: 'treinos_semana_baixo',
    modulo: 'treinos',
    condicao: (ctx) =>
      ctx.diaSemana >= 4 && ctx.treinosNaSemana < ctx.metaTreinosSemana * 0.4,
    mensagem: (ctx) =>
      `Já é ${ctx.diaSemana === 4 ? 'quinta' : ctx.diaSemana === 5 ? 'sexta' : 'fim de semana'} e você fez apenas ${ctx.treinosNaSemana} treino${ctx.treinosNaSemana !== 1 ? 's' : ''} esta semana. Tente encaixar mais sessões!`,
    prioridade: 'alerta',
  },
  {
    id: 'descanso_merecido',
    modulo: 'treinos',
    condicao: (ctx) => !ctx.temTreinoHoje && ctx.treinosNaSemana >= 3,
    mensagem: () =>
      'Hoje é dia de descanso. Aproveite para se recuperar — o músculo cresce no descanso!',
    prioridade: 'info',
  },
  {
    id: 'streak_motivacional',
    modulo: 'treinos',
    condicao: (ctx) => ctx.streakAtual >= 7 && ctx.streakAtual % 7 === 0,
    mensagem: (ctx) =>
      `🔥 ${ctx.streakAtual} dias de streak! Você está em uma sequência incrível. Continue assim!`,
    prioridade: 'info',
  },
];
