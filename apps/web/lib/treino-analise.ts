/** Descanso entre séries do Plano de treino (/treinos/plano): veio do antigo pacote `@meudia/ai`. */

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
