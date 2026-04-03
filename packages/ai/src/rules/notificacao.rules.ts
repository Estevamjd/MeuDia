import type { RegraNotificacao, ContextoUsuario, NotificacaoAgenteInsert } from '@meudia/shared';

/**
 * Regras de notificação proativa do agente.
 * Cada regra verifica uma condição e retorna uma notificação se aplicável.
 */
export const regrasNotificacao: RegraNotificacao[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // TREINO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'faltou_treino',
    modulo: 'treino',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      // Só verificar após 20h
      if (ctx.horaAtual < 20) return null;
      // Verificar se tem treino hoje e não concluiu
      if (!ctx.treinoHoje || ctx.treinoHoje.concluido) return null;

      return {
        tipo: 'alerta',
        titulo: 'Treino não realizado 💪',
        mensagem: `Você tinha "${ctx.treinoHoje.nome}" hoje e não registrou. Ainda dá tempo! Ou registre manualmente se já treinou.`,
        modulo: 'treino',
        acoes: [
          { label: 'Registrar agora', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
          { label: 'Pular hoje', acao: 'MARCAR_DESCANSO' },
        ],
      };
    },
  },
  {
    id: 'treinos_semana_baixo',
    modulo: 'treino',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      // Verificar a partir de quinta-feira (dia 4)
      if (ctx.diaSemana < 4) return null;
      const percentual = ctx.metaTreinosSemana > 0
        ? (ctx.sessoesSemana / ctx.metaTreinosSemana) * 100
        : 0;
      if (percentual >= 40) return null;

      return {
        tipo: 'aviso',
        titulo: 'Semana com poucos treinos',
        mensagem: `Você fez ${ctx.sessoesSemana} de ${ctx.metaTreinosSemana} treinos esta semana. Ainda dá para recuperar!`,
        modulo: 'treino',
        acoes: [
          { label: 'Ver treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HÁBITOS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'habitos_pendentes_noite',
    modulo: 'habito',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      // Só verificar após 21h
      if (ctx.horaAtual < 21) return null;
      if (ctx.habitosPendentes.length === 0) return null;

      const nomes = ctx.habitosPendentes.slice(0, 3).join(', ');
      const extra = ctx.habitosPendentes.length > 3
        ? ` e mais ${ctx.habitosPendentes.length - 3}`
        : '';

      return {
        tipo: 'aviso',
        titulo: `${ctx.habitosPendentes.length} hábito(s) pendente(s)`,
        mensagem: `Você ainda não marcou hoje: ${nomes}${extra}`,
        modulo: 'habito',
        acoes: [
          { label: 'Marcar agora', acao: 'NAVEGAR', payload: { rota: '/habitos' } },
        ],
      };
    },
  },
  {
    id: 'habitos_todos_concluidos',
    modulo: 'habito',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      if (ctx.habitosTotal === 0) return null;
      if (ctx.habitosConcluidos < ctx.habitosTotal) return null;

      return {
        tipo: 'sucesso',
        titulo: 'Todos os hábitos concluídos! 🎉',
        mensagem: `Parabéns! Você completou todos os ${ctx.habitosTotal} hábitos de hoje. Continue assim!`,
        modulo: 'habito',
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANÇAS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'orcamento_ultrapassado',
    modulo: 'financas',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      if (ctx.receitasMes === 0) return null;
      const percentual = (ctx.despesasMes / ctx.receitasMes) * 100;
      if (percentual < 80) return null;

      if (percentual >= 100) {
        return {
          tipo: 'alerta',
          titulo: 'Orçamento ultrapassado! 🚨',
          mensagem: `Suas despesas (R$ ${ctx.despesasMes.toFixed(2)}) ultrapassaram as receitas (R$ ${ctx.receitasMes.toFixed(2)}) este mês.`,
          modulo: 'financas',
          acoes: [
            { label: 'Ver finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
          ],
        };
      }

      return {
        tipo: 'aviso',
        titulo: 'Gastos em alerta ⚠️',
        mensagem: `Você já gastou ${Math.round(percentual)}% da sua receita mensal. Fique atento.`,
        modulo: 'financas',
        acoes: [
          { label: 'Ver finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGENDA
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'compromissos_hoje',
    modulo: 'agenda',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      // Apenas pela manhã
      if (ctx.horaAtual < 7 || ctx.horaAtual > 10) return null;
      if (ctx.compromissosHoje === 0) return null;

      return {
        tipo: 'info',
        titulo: `${ctx.compromissosHoje} compromisso${ctx.compromissosHoje > 1 ? 's' : ''} hoje`,
        mensagem: ctx.proximoCompromisso
          ? `Próximo: ${ctx.proximoCompromisso}`
          : `Você tem ${ctx.compromissosHoje} compromisso${ctx.compromissosHoje > 1 ? 's' : ''} hoje. Confira sua agenda.`,
        modulo: 'agenda',
        acoes: [
          { label: 'Ver agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } },
        ],
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STREAK
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'streak_marco',
    modulo: 'geral',
    verificar: (ctx: ContextoUsuario): NotificacaoAgenteInsert | null => {
      const marcos = [7, 14, 21, 30, 60, 90, 100, 365];
      if (!marcos.includes(ctx.streakAtual)) return null;

      return {
        tipo: 'sucesso',
        titulo: `Streak de ${ctx.streakAtual} dias! 🔥`,
        mensagem: `Incrível! Você manteve a consistência por ${ctx.streakAtual} dias consecutivos. Não pare agora!`,
        modulo: 'geral',
      };
    },
  },
];

/**
 * Executa todas as regras e retorna as notificações aplicáveis.
 */
export function verificarNotificacoes(
  contexto: ContextoUsuario,
): NotificacaoAgenteInsert[] {
  const notificacoes: NotificacaoAgenteInsert[] = [];

  for (const regra of regrasNotificacao) {
    try {
      const resultado = regra.verificar(contexto);
      if (resultado) {
        notificacoes.push(resultado);
      }
    } catch {
      // Silently skip failed rules
    }
  }

  return notificacoes;
}
