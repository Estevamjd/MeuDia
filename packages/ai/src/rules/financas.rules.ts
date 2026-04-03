import type { AIRule } from './types';

export const regrasFinancas: AIRule[] = [
  {
    id: 'saldo_negativo',
    modulo: 'financas',
    condicao: (ctx) => ctx.saldoMes < 0,
    mensagem: () =>
      'Suas despesas estão acima das receitas este mês. Revise seus gastos!',
    prioridade: 'alerta',
  },
  {
    id: 'despesas_altas',
    modulo: 'financas',
    condicao: (ctx) => {
      const receitasMes = ctx.saldoMes + ctx.despesasMes;
      return receitasMes > 0 && ctx.despesasMes > receitasMes * 0.75;
    },
    mensagem: () =>
      'Cuidado: as despesas representam mais de 75% da receita este mês.',
    prioridade: 'aviso',
  },
  {
    id: 'financas_positivas',
    modulo: 'financas',
    condicao: (ctx) => {
      const receitasMes = ctx.saldoMes + ctx.despesasMes;
      return receitasMes > 0 && ctx.despesasMes <= receitasMes * 0.5;
    },
    mensagem: () => 'Finanças no azul! Continue controlando seus gastos.',
    prioridade: 'info',
  },
];
