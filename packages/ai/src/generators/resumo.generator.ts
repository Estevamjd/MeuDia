import type {
  ContextoUsuario,
  ResumoDiario,
  ItemResumo,
  AcaoRapida,
  AIPrioridade,
} from '@meudia/shared';
import { obterSaudacao } from '../agent/contexto';

/**
 * Gera o resumo diário completo para o painel do agente.
 */
export function gerarResumoDiario(contexto: ContextoUsuario): ResumoDiario {
  const saudacao = `${obterSaudacao(contexto.horaAtual)}, ${contexto.nome}!`;
  const itens: ItemResumo[] = [];
  const acoes: AcaoRapida[] = [];
  let prioridade: AIPrioridade = 'info';

  // ── Treino ────────────────────────────────────────────────────────────────
  if (contexto.treinoHoje) {
    if (contexto.treinoHoje.concluido) {
      itens.push({
        icone: '✅',
        texto: `Treino "${contexto.treinoHoje.nome}" concluído`,
        modulo: 'treino',
      });
    } else {
      itens.push({
        icone: '💪',
        texto: `Treino pendente: ${contexto.treinoHoje.nome} (${contexto.treinoHoje.exercicios} exercícios)`,
        modulo: 'treino',
      });
      acoes.push({
        label: 'Iniciar Treino',
        acao: 'NAVEGAR',
        payload: { rota: '/treinos' },
      });

      if (contexto.horaAtual >= 20) {
        prioridade = 'aviso';
      }
    }
  } else {
    itens.push({
      icone: '😴',
      texto: 'Dia de descanso — sem treino programado',
      modulo: 'treino',
    });
  }

  // ── Hábitos ───────────────────────────────────────────────────────────────
  if (contexto.habitosTotal > 0) {
    if (contexto.habitosConcluidos === contexto.habitosTotal) {
      itens.push({
        icone: '🎯',
        texto: `Todos os ${contexto.habitosTotal} hábitos concluídos`,
        modulo: 'habito',
      });
    } else {
      const pendentes = contexto.habitosTotal - contexto.habitosConcluidos;
      itens.push({
        icone: '📋',
        texto: `Hábitos: ${contexto.habitosConcluidos}/${contexto.habitosTotal} — ${pendentes} pendente${pendentes > 1 ? 's' : ''}`,
        modulo: 'habito',
      });

      if (contexto.horaAtual >= 21 && pendentes > 0) {
        prioridade = 'aviso';
        acoes.push({
          label: 'Marcar Hábitos',
          acao: 'NAVEGAR',
          payload: { rota: '/habitos' },
        });
      }
    }
  }

  // ── Agenda ────────────────────────────────────────────────────────────────
  if (contexto.compromissosHoje > 0) {
    itens.push({
      icone: '📅',
      texto: `${contexto.compromissosHoje} compromisso${contexto.compromissosHoje > 1 ? 's' : ''} hoje${contexto.proximoCompromisso ? ` — próximo: ${contexto.proximoCompromisso}` : ''}`,
      modulo: 'agenda',
    });
  }

  // ── Finanças ──────────────────────────────────────────────────────────────
  if (contexto.receitasMes > 0) {
    const percentual = Math.round((contexto.despesasMes / contexto.receitasMes) * 100);
    if (percentual >= 80) {
      itens.push({
        icone: '💰',
        texto: `Gastos em ${percentual}% da receita mensal`,
        modulo: 'financas',
      });
      if (percentual >= 100) prioridade = 'alerta';
    }
  }

  if (contexto.saldoMes < 0) {
    itens.push({
      icone: '🚨',
      texto: `Saldo negativo: R$ ${contexto.saldoMes.toFixed(2)}`,
      modulo: 'financas',
    });
    prioridade = 'alerta';
  }

  // ── Streak ────────────────────────────────────────────────────────────────
  if (contexto.streakAtual > 0) {
    itens.push({
      icone: '🔥',
      texto: `Streak: ${contexto.streakAtual} dia${contexto.streakAtual > 1 ? 's' : ''} consecutivo${contexto.streakAtual > 1 ? 's' : ''}`,
      modulo: 'geral',
    });
  }

  // ── Mensagem principal ────────────────────────────────────────────────────
  const mensagemPrincipal = gerarMensagemPrincipal(contexto, prioridade);

  // Ação padrão se não houver nenhuma
  if (acoes.length === 0) {
    acoes.push({
      label: 'Ver Dashboard',
      acao: 'NAVEGAR',
      payload: { rota: '/inicio' },
    });
  }

  return {
    saudacao,
    mensagemPrincipal,
    itens,
    acoes,
    prioridade,
  };
}

function gerarMensagemPrincipal(
  contexto: ContextoUsuario,
  prioridade: AIPrioridade,
): string {
  // Alerta — algo urgente
  if (prioridade === 'alerta') {
    if (contexto.saldoMes < 0) {
      return 'Atenção com as finanças! Suas despesas ultrapassaram as receitas este mês.';
    }
    return 'Você tem itens que precisam de atenção. Confira os alertas abaixo.';
  }

  // Aviso — algo pendente
  if (prioridade === 'aviso') {
    if (contexto.treinoHoje && !contexto.treinoHoje.concluido && contexto.horaAtual >= 20) {
      return `Ainda não treinou hoje! "${contexto.treinoHoje.nome}" está esperando.`;
    }
    if (contexto.habitosPendentes.length > 0 && contexto.horaAtual >= 21) {
      return `Faltam ${contexto.habitosPendentes.length} hábito${contexto.habitosPendentes.length > 1 ? 's' : ''} para fechar o dia com chave de ouro!`;
    }
    return 'Você tem pendências hoje. Bora resolver!';
  }

  // Info — tudo bem
  if (contexto.treinoHoje?.concluido && contexto.habitosConcluidos === contexto.habitosTotal && contexto.habitosTotal > 0) {
    return 'Dia impecável! Treino feito e todos os hábitos concluídos. Continue assim! 🏆';
  }

  if (contexto.horaAtual < 12) {
    return 'Aqui está o que você tem programado para hoje. Bora começar bem!';
  }

  if (contexto.horaAtual < 18) {
    return 'Como está indo o dia? Confira seu progresso abaixo.';
  }

  return 'Quase acabando o dia. Veja como você está indo!';
}
