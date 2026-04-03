/**
 * Dados de transação para análise financeira.
 */
interface TransacaoAnalise {
  tipo: 'receita' | 'despesa';
  categoria: string;
  valor: number;
  data: string;
}

/**
 * Resultado da análise financeira mensal.
 */
interface AnaliseFinanceira {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  percentualGasto: number;
  maioresGastos: { categoria: string; total: number }[];
  alertas: string[];
  mensagem: string;
}

/**
 * Analisa as transações do mês e retorna insights.
 */
export function analisarFinancasMes(transacoes: TransacaoAnalise[]): AnaliseFinanceira {
  if (transacoes.length === 0) {
    return {
      totalReceitas: 0,
      totalDespesas: 0,
      saldo: 0,
      percentualGasto: 0,
      maioresGastos: [],
      alertas: [],
      mensagem: 'Sem movimentações financeiras registradas este mês.',
    };
  }

  const totalReceitas = transacoes
    .filter((t) => t.tipo === 'receita')
    .reduce((acc, t) => acc + t.valor, 0);

  const totalDespesas = transacoes
    .filter((t) => t.tipo === 'despesa')
    .reduce((acc, t) => acc + t.valor, 0);

  const saldo = totalReceitas - totalDespesas;
  const percentualGasto =
    totalReceitas > 0 ? Math.round((totalDespesas / totalReceitas) * 100) : 0;

  // Top categorias de gasto
  const gastosPorCategoria = new Map<string, number>();
  transacoes
    .filter((t) => t.tipo === 'despesa')
    .forEach((t) => {
      const atual = gastosPorCategoria.get(t.categoria) ?? 0;
      gastosPorCategoria.set(t.categoria, atual + t.valor);
    });

  const maioresGastos = Array.from(gastosPorCategoria.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Alertas
  const alertas: string[] = [];
  if (saldo < 0) {
    alertas.push('Saldo negativo! Despesas ultrapassaram receitas.');
  }
  if (percentualGasto >= 90) {
    alertas.push(`Gastos em ${percentualGasto}% da receita — muito alto.`);
  } else if (percentualGasto >= 75) {
    alertas.push(`Gastos em ${percentualGasto}% da receita — atenção.`);
  }

  // Mensagem
  let mensagem: string;
  if (saldo < 0) {
    mensagem = `Mês no vermelho: R$ ${Math.abs(saldo).toFixed(2)} acima do que entrou. Revise gastos em "${maioresGastos[0]?.categoria ?? 'geral'}" que é sua maior despesa.`;
  } else if (percentualGasto >= 80) {
    mensagem = `Gastos altos (${percentualGasto}%). Maior categoria: "${maioresGastos[0]?.categoria ?? 'geral'}" (R$ ${maioresGastos[0]?.total.toFixed(2) ?? '0'}).`;
  } else if (percentualGasto >= 50) {
    mensagem = `Finanças equilibradas. Saldo: R$ ${saldo.toFixed(2)} (gastou ${percentualGasto}% da receita).`;
  } else {
    mensagem = `Ótimo controle financeiro! Gastou apenas ${percentualGasto}% da receita. Saldo: R$ ${saldo.toFixed(2)}.`;
  }

  return {
    totalReceitas,
    totalDespesas,
    saldo,
    percentualGasto,
    maioresGastos,
    alertas,
    mensagem,
  };
}
