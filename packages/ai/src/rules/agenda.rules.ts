import type { AIRule } from './types';

export const regrasAgenda: AIRule[] = [
  {
    id: 'compromissos_hoje',
    modulo: 'agenda',
    condicao: (ctx) => ctx.compromissosHoje > 0 && ctx.compromissosPendentes > 0,
    mensagem: (ctx) =>
      ctx.compromissosPendentes === 1
        ? 'Você tem 1 compromisso pendente para hoje.'
        : `Você tem ${ctx.compromissosPendentes} compromissos pendentes hoje.`,
    prioridade: 'info',
  },
  {
    id: 'compromissos_concluidos',
    modulo: 'agenda',
    condicao: (ctx) => ctx.compromissosHoje > 0 && ctx.compromissosPendentes === 0,
    mensagem: () => 'Todos os compromissos de hoje foram concluídos!',
    prioridade: 'info',
  },
  {
    id: 'dia_cheio',
    modulo: 'agenda',
    condicao: (ctx) => ctx.compromissosHoje >= 5,
    mensagem: () => 'Dia cheio! Priorize o que é mais importante e não se sobrecarregue.',
    prioridade: 'aviso',
  },
];
