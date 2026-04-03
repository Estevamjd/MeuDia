import type { SugestaoCarga } from '@meudia/shared';

interface HistoricoSerie {
  carga_usada: number | null;
  reps_feitas: number | null;
  repeticoes_meta: number;
  concluido: boolean;
}

/**
 * Analisa o histórico de séries e sugere ajuste de carga.
 * Baseado nas últimas sessões do exercício.
 */
export function analisarCarga(
  historico: HistoricoSerie[],
  cargaAtual: number,
): SugestaoCarga {
  if (historico.length === 0) {
    return {
      sugestao: 'MANTER',
      cargaAtual,
      cargaSugerida: cargaAtual,
      motivo: 'Sem histórico suficiente para análise. Mantenha a carga atual.',
    };
  }

  // Filtrar séries com dados válidos
  const seriesValidas = historico.filter(
    (s) => s.carga_usada !== null && s.reps_feitas !== null,
  );

  if (seriesValidas.length < 2) {
    return {
      sugestao: 'MANTER',
      cargaAtual,
      cargaSugerida: cargaAtual,
      motivo: 'Ainda poucas séries registradas. Continue com a carga atual.',
    };
  }

  // Verificar se todas as séries foram completadas
  const todasCompletas = seriesValidas.every(
    (s) => (s.reps_feitas ?? 0) >= s.repeticoes_meta,
  );

  // Calcular média de carga
  const mediaCarga =
    seriesValidas.reduce((acc, s) => acc + (s.carga_usada ?? 0), 0) /
    seriesValidas.length;

  // Calcular percentual médio de repetições atingidas
  const mediaRepsPercentual =
    seriesValidas.reduce((acc, s) => {
      const feitas = s.reps_feitas ?? 0;
      return acc + (s.repeticoes_meta > 0 ? feitas / s.repeticoes_meta : 0);
    }, 0) / seriesValidas.length;

  // Regra 1: Todas as séries completas em pelo menos 2 sessões → AUMENTAR
  if (todasCompletas && seriesValidas.length >= 2) {
    const incremento = calcularIncremento(mediaCarga);
    return {
      sugestao: 'AUMENTAR',
      cargaAtual: Math.round(mediaCarga * 10) / 10,
      cargaSugerida: Math.round((mediaCarga + incremento) * 10) / 10,
      motivo: `Você completou todas as séries nas últimas sessões. Hora de progredir! 💪`,
    };
  }

  // Regra 2: Muito abaixo da meta (<70%) → REDUZIR
  if (mediaRepsPercentual < 0.7) {
    const reducao = mediaCarga * 0.1;
    return {
      sugestao: 'REDUZIR',
      cargaAtual: Math.round(mediaCarga * 10) / 10,
      cargaSugerida: Math.round((mediaCarga - reducao) * 10) / 10,
      motivo: 'Você não está completando as repetições. Reduza um pouco para manter a técnica.',
    };
  }

  // Regra 3: Manter
  return {
    sugestao: 'MANTER',
    cargaAtual: Math.round(mediaCarga * 10) / 10,
    cargaSugerida: Math.round(mediaCarga * 10) / 10,
    motivo: 'Carga adequada para o momento. Continue assim!',
  };
}

/**
 * Calcula o incremento de carga baseado no peso atual.
 * Cargas menores recebem incrementos proporcionalmente maiores.
 */
function calcularIncremento(cargaAtual: number): number {
  if (cargaAtual <= 10) return 1;
  if (cargaAtual <= 20) return 2;
  if (cargaAtual <= 40) return 2.5;
  if (cargaAtual <= 80) return 5;
  return 5;
}

/**
 * Calcula o tempo de descanso sugerido baseado no exercício.
 */
export function calcularDescansoSugerido(
  tempoDescansoConfigurado: number | null,
  carga: number | null,
  serieAtual: number,
  totalSeries: number,
): number {
  // Se o exercício tem tempo configurado, usar
  if (tempoDescansoConfigurado && tempoDescansoConfigurado > 0) {
    return tempoDescansoConfigurado;
  }

  // Regras inteligentes
  const cargaNum = carga ?? 0;

  // Carga pesada → mais descanso
  if (cargaNum > 80) return 120;
  if (cargaNum > 50) return 90;

  // Última série → um pouco mais de descanso
  if (serieAtual === totalSeries) return 90;

  // Padrão
  return 60;
}

/**
 * Retorna uma dica contextual para exibir durante o descanso entre séries.
 */
export function obterDicaDescanso(serieAtual: number, totalSeries: number): string {
  const dicas = [
    'Hidrate-se! Beba um gole de água agora 💧',
    'Mantenha a respiração controlada entre as séries',
    'Visualize a próxima série sendo executada perfeitamente',
    'Ajuste a carga se necessário para manter a técnica',
    'Alongue levemente o músculo trabalhado',
    'Postura! Mantenha o core ativado',
    'Concentre-se na conexão mente-músculo',
    'Respire fundo: inspire pelo nariz, expire pela boca',
  ];

  // Dicas especiais para última série
  if (serieAtual === totalSeries - 1) {
    return 'Última série vindo! Dê o seu máximo 🔥';
  }

  // Rotacionar dicas
  return dicas[serieAtual % dicas.length] ?? dicas[0] ?? 'Respire fundo e prepare-se!';
}
