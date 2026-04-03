/**
 * Dados de registro de hábito para análise.
 */
interface RegistroDia {
  data: string;
  total: number;
  concluidos: number;
}

/**
 * Resultado da análise de consistência de hábitos.
 */
interface AnaliseConsistencia {
  percentualMedio: number;
  diasPerfeitos: number;
  diasTotal: number;
  tendencia: 'subindo' | 'estavel' | 'caindo';
  melhorDia: string | null;
  piorDia: string | null;
  mensagem: string;
}

/**
 * Analisa a consistência de hábitos nos últimos N dias.
 */
export function analisarConsistencia(registros: RegistroDia[]): AnaliseConsistencia {
  if (registros.length === 0) {
    return {
      percentualMedio: 0,
      diasPerfeitos: 0,
      diasTotal: 0,
      tendencia: 'estavel',
      melhorDia: null,
      piorDia: null,
      mensagem: 'Sem dados suficientes para análise de consistência.',
    };
  }

  const percentuais = registros.map((r) =>
    r.total > 0 ? Math.round((r.concluidos / r.total) * 100) : 0,
  );

  const percentualMedio = Math.round(
    percentuais.reduce((a, b) => a + b, 0) / percentuais.length,
  );

  const diasPerfeitos = percentuais.filter((p) => p === 100).length;

  // Tendência: comparar primeira metade com segunda metade
  const metade = Math.floor(percentuais.length / 2);
  const primeiraMetade = percentuais.slice(0, metade);
  const segundaMetade = percentuais.slice(metade);

  const mediaPrimeira =
    primeiraMetade.length > 0
      ? primeiraMetade.reduce((a, b) => a + b, 0) / primeiraMetade.length
      : 0;
  const mediaSegunda =
    segundaMetade.length > 0
      ? segundaMetade.reduce((a, b) => a + b, 0) / segundaMetade.length
      : 0;

  let tendencia: 'subindo' | 'estavel' | 'caindo' = 'estavel';
  if (mediaSegunda > mediaPrimeira + 5) tendencia = 'subindo';
  else if (mediaSegunda < mediaPrimeira - 5) tendencia = 'caindo';

  // Melhor e pior dia
  let melhorIdx = 0;
  let piorIdx = 0;
  for (let i = 1; i < percentuais.length; i++) {
    const val = percentuais[i] ?? 0;
    const melhorVal = percentuais[melhorIdx] ?? 0;
    const piorVal = percentuais[piorIdx] ?? 0;
    if (val > melhorVal) melhorIdx = i;
    if (val < piorVal) piorIdx = i;
  }

  const melhorReg = registros[melhorIdx];
  const piorReg = registros[piorIdx];
  const melhorDia = melhorReg ? melhorReg.data : null;
  const piorDia = piorReg ? piorReg.data : null;

  // Mensagem
  let mensagem: string;
  if (percentualMedio >= 90) {
    mensagem = `Excelente consistência! Média de ${percentualMedio}% nos últimos ${registros.length} dias. Continue assim! 🏆`;
  } else if (percentualMedio >= 70) {
    mensagem = `Boa consistência (${percentualMedio}%). ${diasPerfeitos} dia${diasPerfeitos !== 1 ? 's' : ''} perfeito${diasPerfeitos !== 1 ? 's' : ''}. Tente manter acima de 80%!`;
  } else if (percentualMedio >= 50) {
    mensagem = `Consistência média de ${percentualMedio}%. Tente focar nos hábitos que mais falta completar.`;
  } else {
    mensagem = `Consistência em ${percentualMedio}%. Que tal simplificar começando com menos hábitos para criar o costume?`;
  }

  if (tendencia === 'subindo') {
    mensagem += ' 📈 Tendência positiva!';
  } else if (tendencia === 'caindo') {
    mensagem += ' 📉 Atenção: tendência de queda.';
  }

  return {
    percentualMedio,
    diasPerfeitos,
    diasTotal: registros.length,
    tendencia,
    melhorDia,
    piorDia,
    mensagem,
  };
}
