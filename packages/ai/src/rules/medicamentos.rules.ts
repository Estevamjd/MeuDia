import type { AIRule } from './types';

export const regrasMedicamentos: AIRule[] = [
  {
    id: 'medicamentos_pendentes',
    modulo: 'geral',
    condicao: (ctx) => ctx.medicamentosPendentes > 0,
    mensagem: (ctx) =>
      ctx.medicamentosPendentes === 1
        ? 'Você tem 1 medicamento pendente para tomar hoje.'
        : `Você tem ${ctx.medicamentosPendentes} medicamentos pendentes para hoje.`,
    prioridade: 'aviso',
  },
  {
    id: 'medicamentos_todos_tomados',
    modulo: 'geral',
    condicao: (ctx) => ctx.medicamentosTomados > 0 && ctx.medicamentosPendentes === 0,
    mensagem: () => 'Todos os medicamentos do dia foram tomados! ✓',
    prioridade: 'info',
  },
  {
    id: 'estoque_baixo',
    modulo: 'geral',
    condicao: (ctx) => ctx.estoqueBaixo.length > 0,
    mensagem: (ctx) =>
      ctx.estoqueBaixo.length === 1
        ? `Estoque baixo de ${ctx.estoqueBaixo[0]}. Hora de reabastecer!`
        : `Estoque baixo de ${ctx.estoqueBaixo.length} medicamentos: ${ctx.estoqueBaixo.join(', ')}`,
    prioridade: 'alerta',
  },
];
