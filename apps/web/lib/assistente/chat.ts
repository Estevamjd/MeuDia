import type { AcaoRapida, RespostaAgente } from '@meudia/shared';
import { classificarIntencao } from './intencao';

/**
 * Respostas locais do chat do assistente (regras, sem LLM). Veio do antigo pacote `@meudia/ai`, só com o que
 * existe no app: treino, finanças, resumo e saudação. Agenda/tarefas, hábitos e notas não existem mais: o
 * pedido recebe "não está disponível" e nenhuma ação leva a uma rota que não existe. Relato de gasto com valor
 * vai antes para a IA (`deveConsultarIA` → `/api/ia/chat`); isto é o caminho sem IA (fallback, perguntas).
 */

export interface ContextoAssistente {
  nome: string;
  horaAtual: number;
  treinoHoje: { nome: string; exercicios: number; concluido: boolean } | null;
  sessoesSemana: number;
  metaTreinosSemana: number;
  saldoMes: number;
  despesasMes: number;
  receitasMes: number;
}

interface MensagemHistorico {
  role: string;
  conteudo: string;
}

export type ModuloIndisponivel = 'agenda' | 'habitos' | 'notas';

const NOME_MODULO: Record<ModuloIndisponivel, string> = {
  agenda: 'A agenda (compromissos e tarefas) não está disponível',
  habitos: 'Hábitos não estão disponíveis',
  notas: 'Notas não estão disponíveis',
};

/** Sugestões do chat (e o que acompanha o aviso de módulo indisponível). */
export const SUGESTOES_ASSISTENTE: AcaoRapida[] = [
  { label: 'Resumo financeiro', acao: 'COMANDO', payload: { comando: 'como estão minhas finanças?' } },
  { label: 'Quanto gastei?', acao: 'COMANDO', payload: { comando: 'quanto gastei este mês?' } },
  { label: 'Ver contas', acao: 'NAVEGAR', payload: { rota: '/financas/contas' } },
  { label: 'Ver orçamento', acao: 'NAVEGAR', payload: { rota: '/financas/orcamento' } },
];

// Texto igual ao da produção (modo Finanças) antes da faxina.
export function mensagemModuloIndisponivel(modulo: ModuloIndisponivel): string {
  return `${NOME_MODULO[modulo]} no modo Finanças. Aqui eu anoto gastos e acompanho suas contas: tente "gastei 45 no mercado".`;
}

function respostaIndisponivel(modulo: ModuloIndisponivel): RespostaAgente {
  return { mensagem: mensagemModuloIndisponivel(modulo), acoes: SUGESTOES_ASSISTENTE.slice(0, 2) };
}

export function obterSaudacao(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Responde uma mensagem do usuário com as regras locais (histórico recente para "sim"/"não"/"gasto"). */
export function processarMensagem(
  mensagem: string,
  contexto: ContextoAssistente,
  historicoRecente?: MensagemHistorico[],
): RespostaAgente {
  const continuacao = verificarContinuacao(mensagem, contexto, historicoRecente);
  if (continuacao) return continuacao;

  const intencao = classificarIntencao(mensagem);
  switch (intencao.tipo) {
    case 'CONSULTA_TREINO':
      return respostaTreino(contexto, intencao.parametros);
    case 'CRIAR_TREINO':
      return respostaCriarTreino(intencao.parametros);
    case 'AGENDAR_TREINO':
    case 'CONSULTA_AGENDA':
    case 'CRIAR_COMPROMISSO':
      return respostaIndisponivel('agenda');
    case 'CONSULTA_HABITOS':
    case 'CRIAR_HABITO':
      return respostaIndisponivel('habitos');
    case 'CONSULTA_NOTAS':
      return respostaIndisponivel('notas');
    case 'CONSULTA_FINANCAS':
      return respostaFinancas(contexto);
    case 'RESUMO_DIA':
      return resumoDia(contexto);
    case 'CRIAR_TRANSACAO':
      return respostaCriarTransacao(intencao.parametros);
    case 'SAUDACAO':
      return respostaSaudacao(contexto);
    default:
      return respostaGenerica(mensagem, contexto);
  }
}

// ── Continuação de conversa (memória curta) ──

function verificarContinuacao(
  mensagem: string,
  contexto: ContextoAssistente,
  historico?: MensagemHistorico[],
): RespostaAgente | null {
  if (!historico || historico.length < 2) return null;
  const ultimaDoAgente = [...historico].reverse().find((m) => m.role === 'agent');
  if (!ultimaDoAgente) return null;

  const agMsg = ultimaDoAgente.conteudo.toLowerCase();
  const userMsg = mensagem.trim().toLowerCase();

  // Agente perguntou "ver ou criar?" e o usuário respondeu "criar".
  if (
    /(?:criar|ver|consultar)/i.test(agMsg) &&
    /^(?:criar|cria|novo|nova|sim|quero|quero criar|criar sim|sim,?\s*criar|vamos|bora)$/i.test(userMsg)
  ) {
    if (/treino/i.test(agMsg)) return respostaCriarTreino({});
    if (/finan|gasto|despesa/i.test(agMsg)) return respostaCriarTransacao({});
  }

  // Agente perguntou "ver ou criar?" e o usuário quer ver.
  if (/(?:criar|ver|consultar)/i.test(agMsg) && /^(?:ver|consultar|mostrar|abrir|sim.*ver|quero ver)$/i.test(userMsg)) {
    if (/treino/i.test(agMsg)) return respostaTreino(contexto);
    if (/finan/i.test(agMsg)) return respostaFinancas(contexto);
  }

  // Agente perguntou se é gasto ou receita.
  if (/gasto ou.*receita|despesa ou.*receita/i.test(agMsg)) {
    const tipo = /(?:gasto|despesa|paguei|gastei)/i.test(mensagem) ? 'despesa' : 'receita';
    return respostaCriarTransacao({ tipo });
  }

  // "Sim" para uma oferta de criar.
  if (
    /^(?:sim|s|yes|ok|pode|claro|isso|exato|confirmo)$/i.test(userMsg) &&
    /(?:quer|deseja|gostaria|posso|devo)\s+(?:criar|adicionar|registrar)/i.test(agMsg)
  ) {
    if (/treino/i.test(agMsg)) return respostaCriarTreino({});
    if (/gasto|despesa|transa[çc]/i.test(agMsg)) return respostaCriarTransacao({});
  }

  if (/^(?:n[aã]o|nao|n|cancel|deixa|esquece)$/i.test(userMsg)) {
    return { mensagem: 'Tudo bem! Se precisar de algo, é só me chamar.', acoes: [] };
  }

  return null;
}

// ── Treino ──

function statusTreino(contexto: ContextoAssistente): string {
  if (!contexto.treinoHoje) return 'Hoje é dia de descanso. Aproveite para recuperar!';
  if (contexto.treinoHoje.concluido) return `Treino "${contexto.treinoHoje.nome}" concluído! Excelente trabalho.`;
  return `Treino de hoje: ${contexto.treinoHoje.nome} (${contexto.treinoHoje.exercicios} exercícios). Bora treinar!`;
}

function respostaTreino(contexto: ContextoAssistente, parametros?: Record<string, string>): RespostaAgente {
  if (parametros?.exercicio) {
    return {
      mensagem: `Para ver seu histórico de ${parametros.exercicio}, acesse a página de treinos e verifique as séries registradas.`,
      acoes: [{ label: 'Ir para Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } }],
    };
  }
  const acoes: AcaoRapida[] = [];
  if (contexto.treinoHoje && !contexto.treinoHoje.concluido) {
    acoes.push({ label: 'Iniciar Treino', acao: 'NAVEGAR', payload: { rota: '/treinos' } });
  }
  acoes.push({ label: `${contexto.sessoesSemana}/${contexto.metaTreinosSemana} na semana`, acao: 'INFO' });
  return { mensagem: statusTreino(contexto), acoes };
}

function respostaCriarTreino(parametros?: Record<string, string>): RespostaAgente {
  const grupo = parametros?.grupoMuscular ?? 'personalizado';
  const nivel = parametros?.nivel ?? 'intermediário';
  return {
    mensagem: `Para criar um treino de ${grupo} (nível ${nivel}), vá até a página de Treinos e use o botão de adicionar.`,
    acoes: [{ label: 'Ir para Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } }],
  };
}

// ── Finanças ──

function statusFinancas(contexto: ContextoAssistente): string {
  if (contexto.receitasMes === 0 && contexto.despesasMes === 0) {
    return 'Sem movimentações financeiras registradas este mês.';
  }
  const percentual = contexto.receitasMes > 0 ? Math.round((contexto.despesasMes / contexto.receitasMes) * 100) : 0;
  if (contexto.saldoMes < 0) {
    return `Atenção: saldo negativo este mês (R$ ${contexto.saldoMes.toFixed(2)}). Despesas ultrapassaram receitas.`;
  }
  if (percentual > 80) return `Gastos em ${percentual}% da receita. Cuidado para não ultrapassar o orçamento.`;
  return `Saldo do mês: R$ ${contexto.saldoMes.toFixed(2)}. Gastos em ${percentual}% da receita.`;
}

function respostaFinancas(contexto: ContextoAssistente): RespostaAgente {
  return {
    mensagem: statusFinancas(contexto),
    acoes: [{ label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
  };
}

function respostaCriarTransacao(parametros?: Record<string, string>): RespostaAgente {
  const valor = parametros?.valor;
  const descricao = parametros?.descricao;
  const tipo = parametros?.tipo;
  const gastoOuReceita: AcaoRapida[] = [
    { label: 'Gasto', acao: 'COMANDO', payload: { comando: 'gasto' } },
    { label: 'Receita', acao: 'COMANDO', payload: { comando: 'receita' } },
  ];

  if (valor && descricao) {
    if (!tipo) {
      return { mensagem: `Registrando: ${descricao} — R$ ${valor}\nIsso é um gasto ou uma receita?`, acoes: gastoOuReceita };
    }
    return {
      mensagem: `Registrando: ${descricao} — R$ ${valor} (${tipo}). Acesse Finanças para confirmar.`,
      acoes: [{ label: 'Ir para Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
    };
  }
  if (valor) return { mensagem: `Valor: R$ ${valor}. É um gasto ou receita?`, acoes: gastoOuReceita };
  return {
    mensagem:
      'Para registrar uma transação, vá até Finanças. Ou me diga algo como:\n"Gastei R$ 50 no mercado" ou "Recebi R$ 3000 de salário"',
    acoes: [{ label: 'Ir para Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
  };
}

// ── Resumo, saudação e fallback ──

function resumoDia(contexto: ContextoAssistente): RespostaAgente {
  const saudacao = obterSaudacao(contexto.horaAtual);
  const partes: string[] = [];
  if (contexto.treinoHoje) {
    partes.push(
      contexto.treinoHoje.concluido
        ? `Treino "${contexto.treinoHoje.nome}" concluído!`
        : `Treino pendente: ${contexto.treinoHoje.nome} (${contexto.treinoHoje.exercicios} exercícios)`,
    );
  } else {
    partes.push('Sem treino agendado para hoje (dia de descanso).');
  }
  if (contexto.despesasMes > 0 || contexto.receitasMes > 0) {
    partes.push(`Saldo do mês: R$ ${contexto.saldoMes.toFixed(2)}`);
  }
  return {
    mensagem: `${saudacao}, ${contexto.nome}! Aqui está seu resumo:\n\n${partes.join('\n')}`,
    acoes: [
      { label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
      { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
    ],
  };
}

function respostaSaudacao(contexto: ContextoAssistente): RespostaAgente {
  const partes = [`${obterSaudacao(contexto.horaAtual)}, ${contexto.nome}! Como posso te ajudar?`];
  if (contexto.treinoHoje && !contexto.treinoHoje.concluido) {
    partes.push(`Você tem treino hoje: ${contexto.treinoHoje.nome}`);
  }
  return {
    mensagem: partes.join('\n'),
    acoes: [
      { label: 'Resumo do dia', acao: 'COMANDO', payload: { comando: 'resumo do dia' } },
      { label: 'Meu treino', acao: 'COMANDO', payload: { comando: 'qual meu treino hoje?' } },
      SUGESTOES_ASSISTENTE[0]!,
    ],
  };
}

const PALAVRAS_FALLBACK: [ModuloIndisponivel | 'treino' | 'financas', string[]][] = [
  ['agenda', ['agenda', 'compromisso', 'evento', 'reuniao', 'consulta', 'entrevista', 'festa', 'aniversario', 'marcar', 'agendar', 'calendario', 'prova', 'medico', 'dentista']],
  ['treino', ['treino', 'treinar', 'exercicio', 'academia', 'musculacao', 'peito', 'costas', 'perna', 'biceps', 'triceps', 'ombro']],
  ['habitos', ['habito', 'habitos', 'rotina', 'streak', 'consistencia', 'pendente']],
  ['financas', ['financa', 'financas', 'gasto', 'despesa', 'receita', 'dinheiro', 'saldo', 'orcamento', 'boleto', 'fatura', 'salario', 'paguei', 'gastei', 'comprei']],
];

function respostaGenerica(mensagem: string, contexto: ContextoAssistente): RespostaAgente {
  const norm = mensagem.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const modulo = PALAVRAS_FALLBACK.find(([, palavras]) => palavras.some((p) => norm.includes(p)))?.[0];

  if (modulo === 'agenda' || modulo === 'habitos') return respostaIndisponivel(modulo);
  if (modulo === 'treino') {
    return {
      mensagem: 'Isso é sobre treinos! Quer ver seu treino de hoje ou criar um novo?',
      acoes: [
        { label: 'Meu treino', acao: 'COMANDO', payload: { comando: 'qual meu treino hoje?' } },
        { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
      ],
    };
  }
  if (modulo === 'financas') {
    return {
      mensagem: 'Isso é sobre finanças! Quer registrar um gasto ou ver seu resumo financeiro?',
      acoes: [
        SUGESTOES_ASSISTENTE[0]!,
        { label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
      ],
    };
  }
  return {
    mensagem:
      `Não entendi exatamente, ${contexto.nome}. Posso te ajudar com:\n\n` +
      `Finanças — "gastei R$ 50 no mercado"\n` +
      `Treinos — "qual meu treino hoje?"\n` +
      `Resumo — "resumo do dia"\n\n` +
      `Tente me dizer de outra forma!`,
    acoes: [
      { label: 'Resumo do dia', acao: 'COMANDO', payload: { comando: 'resumo do dia' } },
      SUGESTOES_ASSISTENTE[0]!,
      { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
    ],
  };
}
