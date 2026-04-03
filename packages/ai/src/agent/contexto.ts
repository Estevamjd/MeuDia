import type { ContextoUsuario } from '@meudia/shared';

/**
 * Gera a saudação apropriada baseada na hora do dia.
 */
export function obterSaudacao(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Gera a mensagem de status do treino baseada no contexto.
 */
export function statusTreino(contexto: ContextoUsuario): string {
  if (!contexto.treinoHoje) {
    return 'Hoje é dia de descanso. Aproveite para recuperar!';
  }

  if (contexto.treinoHoje.concluido) {
    return `Treino "${contexto.treinoHoje.nome}" concluído! Excelente trabalho.`;
  }

  return `Treino de hoje: ${contexto.treinoHoje.nome} (${contexto.treinoHoje.exercicios} exercícios). Bora treinar!`;
}

/**
 * Gera a mensagem de status dos hábitos baseada no contexto.
 */
export function statusHabitos(contexto: ContextoUsuario): string {
  if (contexto.habitosTotal === 0) {
    return 'Nenhum hábito programado para hoje.';
  }

  if (contexto.habitosConcluidos === contexto.habitosTotal) {
    return `Todos os ${contexto.habitosTotal} hábitos concluídos! Dia perfeito.`;
  }

  const pendentes = contexto.habitosTotal - contexto.habitosConcluidos;
  return `${contexto.habitosConcluidos}/${contexto.habitosTotal} hábitos concluídos. Faltam ${pendentes}: ${contexto.habitosPendentes.slice(0, 3).join(', ')}${contexto.habitosPendentes.length > 3 ? '...' : ''}.`;
}

/**
 * Gera a mensagem de status financeiro baseada no contexto.
 */
export function statusFinancas(contexto: ContextoUsuario): string {
  if (contexto.receitasMes === 0 && contexto.despesasMes === 0) {
    return 'Sem movimentações financeiras registradas este mês.';
  }

  const percentual =
    contexto.receitasMes > 0
      ? Math.round((contexto.despesasMes / contexto.receitasMes) * 100)
      : 0;

  if (contexto.saldoMes < 0) {
    return `Atenção: saldo negativo este mês (R$ ${contexto.saldoMes.toFixed(2)}). Despesas ultrapassaram receitas.`;
  }

  if (percentual > 80) {
    return `Gastos em ${percentual}% da receita. Cuidado para não ultrapassar o orçamento.`;
  }

  return `Saldo do mês: R$ ${contexto.saldoMes.toFixed(2)}. Gastos em ${percentual}% da receita.`;
}

/**
 * Gera mensagem de status da agenda baseada no contexto.
 */
export function statusAgenda(contexto: ContextoUsuario): string {
  if (contexto.compromissosHoje === 0) {
    return 'Agenda livre hoje!';
  }

  const msg = `${contexto.compromissosHoje} compromisso${contexto.compromissosHoje > 1 ? 's' : ''} hoje.`;
  if (contexto.proximoCompromisso) {
    return `${msg} Próximo: ${contexto.proximoCompromisso}.`;
  }
  return msg;
}
