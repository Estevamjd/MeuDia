import type {
  ContextoUsuario,
  RespostaAgente,
  AcaoRapida,
} from '@meudia/shared';
import { classificarIntencao, extrairParametros } from './intencao';
import {
  obterSaudacao,
  statusTreino,
  statusHabitos,
  statusFinancas,
  statusAgenda,
} from './contexto';

// ══════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ══════════════════════════════════════════════════════════════════════════════

interface MensagemHistorico {
  role: string;
  conteudo: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Função principal
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Processa uma mensagem do usuário e gera uma resposta do agente.
 * Usa classificação de intenção por regex (sem API externa).
 * Aceita histórico recente para continuação de conversa.
 */
export function processarMensagem(
  mensagem: string,
  contexto: ContextoUsuario,
  historicoRecente?: MensagemHistorico[],
): RespostaAgente {
  // ── Verificar continuação de conversa ──
  const respostaContinuacao = verificarContinuacao(mensagem, contexto, historicoRecente);
  if (respostaContinuacao) return respostaContinuacao;

  // ── Classificar intenção da mensagem ──
  const intencao = classificarIntencao(mensagem);

  switch (intencao.tipo) {
    case 'CONSULTA_TREINO':
      return gerarRespostaTreino(contexto, intencao.parametros);
    case 'CRIAR_TREINO':
      return gerarRespostaCriarTreino(intencao.parametros);
    case 'AGENDAR_TREINO':
      return gerarRespostaAgendarTreino(contexto, intencao.parametros);
    case 'CONSULTA_HABITOS':
      return gerarRespostaHabitos(contexto);
    case 'CONSULTA_AGENDA':
      return gerarRespostaAgenda(contexto);
    case 'CONSULTA_FINANCAS':
      return gerarRespostaFinancas(contexto);
    case 'RESUMO_DIA':
      return gerarResumoDia(contexto);
    case 'CRIAR_COMPROMISSO':
      return gerarRespostaCriarCompromisso(contexto, intencao.parametros);
    case 'CRIAR_HABITO':
      return gerarRespostaCriarHabito(intencao.parametros);
    case 'CRIAR_TRANSACAO':
      return gerarRespostaCriarTransacao(intencao.parametros);
    case 'CONSULTA_NOTAS':
      return {
        mensagem: 'Abrindo suas notas!',
        acoes: [{ label: 'Abrir Notas', acao: 'NAVEGAR', payload: { rota: '/notas' } }],
      };
    case 'SAUDACAO':
      return gerarRespostaSaudacao(contexto);
    default:
      return gerarRespostaGenerica(mensagem, contexto);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Continuação de Conversa (memória curta)
// ══════════════════════════════════════════════════════════════════════════════

function verificarContinuacao(
  mensagem: string,
  contexto: ContextoUsuario,
  historico?: MensagemHistorico[],
): RespostaAgente | null {
  if (!historico || historico.length < 2) return null;

  const ultimaDoAgente = [...historico]
    .reverse()
    .find((m) => m.role === 'agent');

  if (!ultimaDoAgente) return null;

  const agMsg = ultimaDoAgente.conteudo.toLowerCase();
  const userMsg = mensagem.trim().toLowerCase();

  // ── Caso 1: Agente perguntou "criar ou ver?" e usuário respondeu "criar" ──
  if (
    /(?:criar|ver|consultar)\s*(?:um|uma|o|a)?\s*(?:compromisso|evento)?|quer criar.*ou ver/i.test(agMsg) &&
    /^(?:criar|cria|novo|nova|sim|quero|quero criar|criar sim|sim,?\s*criar|vamos|bora)$/i.test(userMsg)
  ) {
    if (/agenda|compromisso|evento/i.test(agMsg)) {
      return gerarRespostaCriarCompromisso(contexto, {});
    }
    if (/treino/i.test(agMsg)) {
      return gerarRespostaCriarTreino({});
    }
    if (/h[aá]bito/i.test(agMsg)) {
      return gerarRespostaCriarHabito({});
    }
    if (/finan|gasto|despesa/i.test(agMsg)) {
      return gerarRespostaCriarTransacao({});
    }
  }

  // ── Caso 2: Agente perguntou "ver" e usuário confirmou ──
  if (
    /(?:criar|ver|consultar)/i.test(agMsg) &&
    /^(?:ver|consultar|mostrar|abrir|sim.*ver|quero ver)$/i.test(userMsg)
  ) {
    if (/agenda|compromisso/i.test(agMsg)) {
      return gerarRespostaAgenda(contexto);
    }
    if (/treino/i.test(agMsg)) {
      return gerarRespostaTreino(contexto);
    }
    if (/h[aá]bito/i.test(agMsg)) {
      return gerarRespostaHabitos(contexto);
    }
    if (/finan/i.test(agMsg)) {
      return gerarRespostaFinancas(contexto);
    }
  }

  // ── Caso 3: Agente perguntou data/horário e usuário respondeu ──
  if (
    /(?:para quando|qual (?:dia|data|hor[aá]rio)|que dia|que horas|quando)/i.test(agMsg) &&
    /(?:\d{1,2}[\s/\u002d]|janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|amanh[aã]|segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo|\d+h)/i.test(
      mensagem,
    )
  ) {
    return gerarRespostaCriarCompromisso(contexto, extrairParametros(mensagem));
  }

  // ── Caso 4: Agente perguntou gasto ou receita ──
  if (/gasto ou.*receita|despesa ou.*receita/i.test(agMsg)) {
    const tipo = /(?:gasto|despesa|paguei|gastei)/i.test(mensagem)
      ? 'despesa'
      : 'receita';
    return gerarRespostaCriarTransacao({ tipo });
  }

  // ── Caso 5: Agente perguntou "qual título/nome?" e usuário respondeu ──
  if (/(?:qual (?:o )?(?:t[ií]tulo|nome|assunto)|como (?:quer chamar|seria))/i.test(agMsg)) {
    return gerarRespostaCriarCompromisso(contexto, { assunto: mensagem.trim() });
  }

  // ── Caso 6: Resposta curta "sim/não" ──
  if (/^(?:sim|s|yes|ok|pode|claro|isso|exato|confirmo)$/i.test(userMsg)) {
    if (/(?:quer|deseja|gostaria|posso|devo)\s+(?:criar|adicionar|agendar|marcar|registrar)/i.test(agMsg)) {
      if (/compromisso|agenda|evento/i.test(agMsg)) {
        return gerarRespostaCriarCompromisso(contexto, {});
      }
      if (/treino/i.test(agMsg)) {
        return gerarRespostaCriarTreino({});
      }
      if (/h[aá]bito/i.test(agMsg)) {
        return gerarRespostaCriarHabito({});
      }
      if (/gasto|despesa|transa[çc]/i.test(agMsg)) {
        return gerarRespostaCriarTransacao({});
      }
    }
  }

  // ── Caso 7: Resposta "não" ──
  if (/^(?:n[aã]o|nao|n|cancel|deixa|esquece)$/i.test(userMsg)) {
    return {
      mensagem: 'Tudo bem! Se precisar de algo, é só me chamar.',
      acoes: [],
    };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Handlers — Consultas
// ══════════════════════════════════════════════════════════════════════════════

function gerarRespostaTreino(
  contexto: ContextoUsuario,
  parametros?: Record<string, string>,
): RespostaAgente {
  const acoes: AcaoRapida[] = [];

  if (parametros?.exercicio) {
    return {
      mensagem: `Para ver seu histórico de ${parametros.exercicio}, acesse a página de treinos e verifique as séries registradas.`,
      acoes: [{ label: 'Ir para Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } }],
    };
  }

  const msg = statusTreino(contexto);

  if (contexto.treinoHoje && !contexto.treinoHoje.concluido) {
    acoes.push({ label: 'Iniciar Treino', acao: 'NAVEGAR', payload: { rota: '/treinos' } });
  }

  acoes.push({
    label: `${contexto.sessoesSemana}/${contexto.metaTreinosSemana} na semana`,
    acao: 'INFO',
  });

  return { mensagem: msg, acoes };
}

function gerarRespostaCriarTreino(parametros?: Record<string, string>): RespostaAgente {
  const grupo = parametros?.grupoMuscular ?? 'personalizado';
  const nivel = parametros?.nivel ?? 'intermediário';

  return {
    mensagem: `Para criar um treino de ${grupo} (nível ${nivel}), vá até a página de Treinos e use o botão de adicionar.`,
    acoes: [{ label: 'Ir para Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } }],
  };
}

function gerarRespostaAgendarTreino(
  _contexto: ContextoUsuario,
  parametros?: Record<string, string>,
): RespostaAgente {
  const dia = parametros?.dia ?? 'o dia selecionado';
  const hora = parametros?.hora;

  let msg = `Para agendar seu treino para ${dia}`;
  if (hora) msg += ` às ${hora}`;
  msg += ', acesse a agenda e crie um compromisso com o tipo "treino".';

  return {
    mensagem: msg,
    acoes: [
      { label: 'Abrir Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } },
      { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
    ],
  };
}

function gerarRespostaHabitos(contexto: ContextoUsuario): RespostaAgente {
  const msg = statusHabitos(contexto);
  const acoes: AcaoRapida[] = [
    { label: 'Ver Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } },
  ];

  if (contexto.streakAtual > 0) {
    acoes.push({ label: `Streak: ${contexto.streakAtual} dias`, acao: 'INFO' });
  }

  return { mensagem: msg, acoes };
}

function gerarRespostaAgenda(contexto: ContextoUsuario): RespostaAgente {
  return {
    mensagem: statusAgenda(contexto),
    acoes: [{ label: 'Abrir Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } }],
  };
}

function gerarRespostaFinancas(contexto: ContextoUsuario): RespostaAgente {
  return {
    mensagem: statusFinancas(contexto),
    acoes: [{ label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Handlers — Criação
// ══════════════════════════════════════════════════════════════════════════════

function gerarRespostaCriarCompromisso(
  _contexto: ContextoUsuario,
  parametros?: Record<string, string>,
): RespostaAgente {
  const acoes: AcaoRapida[] = [];
  const assunto = parametros?.assunto;
  const dia = parametros?.dia;
  const mes = parametros?.mes;
  const hora = parametros?.hora;
  const diaSemana = parametros?.diaSemana;

  // Montar data legível
  let dataStr = '';
  if (dia === 'amanha') {
    dataStr = 'amanhã';
  } else if (dia && mes) {
    dataStr = `dia ${dia} de ${mes}`;
  } else if (dia) {
    dataStr = `dia ${dia}`;
  } else if (diaSemana) {
    dataStr = diaSemana;
  }

  // Converter para ISO se possível
  let dataISO: string | null = null;
  if (dia && dia !== 'amanha') {
    const now = new Date();
    const mesNum = mes ? mesParaNumero(mes) : now.getMonth();
    const ano = now.getFullYear();
    const hParts = hora ? hora.split(':') : [];
    const horaNum = hParts[0] ? parseInt(hParts[0], 10) : 9;
    const minNum = hParts[1] ? parseInt(hParts[1], 10) : 0;
    const data = new Date(ano, mesNum, parseInt(dia, 10), horaNum, minNum);
    if (!isNaN(data.getTime())) {
      dataISO = data.toISOString();
    }
  } else if (dia === 'amanha') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hParts2 = hora ? hora.split(':') : [];
    const horaNum = hParts2[0] ? parseInt(hParts2[0], 10) : 9;
    const minNum = hParts2[1] ? parseInt(hParts2[1], 10) : 0;
    tomorrow.setHours(horaNum, minNum, 0, 0);
    dataISO = tomorrow.toISOString();
  }

  const partes: string[] = [];

  if (assunto && dataStr && dataISO) {
    // Temos tudo — oferecer botão "Criar Agora"
    const titulo = assunto.charAt(0).toUpperCase() + assunto.slice(1);
    partes.push(`Entendi! Vou criar na sua agenda:`);
    partes.push(`${titulo} — ${dataStr}${hora ? ` às ${hora}` : ''}`);
    partes.push('Clique em "Criar Agora" para confirmar.');

    acoes.push({
      label: 'Criar Agora',
      acao: 'CRIAR_COMPROMISSO',
      payload: {
        titulo,
        data_inicio: dataISO,
        tipo: 'geral',
      },
    });
    acoes.push({ label: 'Abrir Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } });
  } else if (assunto && dataStr) {
    partes.push(`Entendi: ${assunto} para ${dataStr}${hora ? ` às ${hora}` : ''}.`);
    partes.push('Clique abaixo para abrir a agenda e criar o compromisso.');
    acoes.push({ label: 'Abrir Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } });
  } else if (assunto) {
    partes.push(`Entendi! Você quer agendar: ${assunto}.`);
    partes.push('Para quando seria? (Ex: "dia 15 de abril às 14h")');
  } else if (dataStr) {
    partes.push(`Certo! Você quer criar algo para ${dataStr}${hora ? ` às ${hora}` : ''}.`);
    partes.push('Qual é o título ou assunto? (Ex: "entrevista de emprego")');
  } else {
    partes.push('Vamos criar um compromisso na sua agenda!');
    partes.push('Me diga o que e para quando. Por exemplo:');
    partes.push('"Entrevista dia 22 de abril às 14h"');
  }

  return { mensagem: partes.join('\n'), acoes };
}

/** Converte nome de mês para número (0-11). */
function mesParaNumero(mes: string): number {
  const norm = mes
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const meses: Record<string, number> = {
    janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  };
  if (meses[norm] !== undefined) return meses[norm];
  // Se for número ("04")
  const num = parseInt(norm, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num - 1;
  return new Date().getMonth();
}

function gerarRespostaCriarHabito(parametros?: Record<string, string>): RespostaAgente {
  const nome = parametros?.assunto;
  if (nome) {
    return {
      mensagem: `Boa ideia criar o hábito "${nome}"! Vá até a página de Hábitos e adicione.`,
      acoes: [{ label: 'Ir para Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } }],
    };
  }
  return {
    mensagem: 'Vamos criar um novo hábito! Vá até Hábitos e clique em adicionar. Que tal algo como ler, meditar, ou beber mais água?',
    acoes: [{ label: 'Ir para Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } }],
  };
}

function gerarRespostaCriarTransacao(parametros?: Record<string, string>): RespostaAgente {
  const valor = parametros?.valor;
  const descricao = parametros?.descricao;
  const tipo = parametros?.tipo;

  if (valor && descricao) {
    if (!tipo) {
      return {
        mensagem: `Registrando: ${descricao} — R$ ${valor}\nIsso é um gasto ou uma receita?`,
        acoes: [
          { label: 'Gasto', acao: 'COMANDO', payload: { comando: 'gasto' } },
          { label: 'Receita', acao: 'COMANDO', payload: { comando: 'receita' } },
        ],
      };
    }
    return {
      mensagem: `Registrando: ${descricao} — R$ ${valor} (${tipo}). Acesse Finanças para confirmar.`,
      acoes: [{ label: 'Ir para Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
    };
  }

  if (valor) {
    return {
      mensagem: `Valor: R$ ${valor}. É um gasto ou receita?`,
      acoes: [
        { label: 'Gasto', acao: 'COMANDO', payload: { comando: 'gasto' } },
        { label: 'Receita', acao: 'COMANDO', payload: { comando: 'receita' } },
      ],
    };
  }

  return {
    mensagem: 'Para registrar uma transação, vá até Finanças. Ou me diga algo como:\n"Gastei R$ 50 no mercado" ou "Recebi R$ 3000 de salário"',
    acoes: [{ label: 'Ir para Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Handlers — Resumo e Saudação
// ══════════════════════════════════════════════════════════════════════════════

function gerarResumoDia(contexto: ContextoUsuario): RespostaAgente {
  const saudacao = obterSaudacao(contexto.horaAtual);
  const partes: string[] = [];

  if (contexto.treinoHoje) {
    if (contexto.treinoHoje.concluido) {
      partes.push(`Treino "${contexto.treinoHoje.nome}" concluído!`);
    } else {
      partes.push(`Treino pendente: ${contexto.treinoHoje.nome} (${contexto.treinoHoje.exercicios} exercícios)`);
    }
  } else {
    partes.push('Sem treino agendado para hoje (dia de descanso).');
  }

  if (contexto.habitosTotal > 0) {
    partes.push(`Hábitos: ${contexto.habitosConcluidos}/${contexto.habitosTotal} (${contexto.percentualHabitos}%)`);
    if (contexto.habitosPendentes.length > 0 && contexto.habitosPendentes.length <= 3) {
      partes.push(`Pendentes: ${contexto.habitosPendentes.join(', ')}`);
    }
  }

  if (contexto.compromissosHoje > 0) {
    partes.push(`${contexto.compromissosHoje} compromisso(s) hoje.`);
    if (contexto.proximoCompromisso) {
      partes.push(`Próximo: ${contexto.proximoCompromisso}`);
    }
  }

  if (contexto.despesasMes > 0 || contexto.receitasMes > 0) {
    partes.push(`Saldo do mês: R$ ${contexto.saldoMes.toFixed(2)}`);
  }

  const mensagem =
    partes.length > 0
      ? `${saudacao}, ${contexto.nome}! Aqui está seu resumo:\n\n${partes.join('\n')}`
      : `${saudacao}, ${contexto.nome}! Seu dia está tranquilo por enquanto. Quer criar algum compromisso ou registrar algo?`;

  return {
    mensagem,
    acoes: [
      { label: 'Ver Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } },
      { label: 'Ver Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } },
      { label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
    ],
  };
}

function gerarRespostaSaudacao(contexto: ContextoUsuario): RespostaAgente {
  const saudacao = obterSaudacao(contexto.horaAtual);
  const partes: string[] = [`${saudacao}, ${contexto.nome}! Como posso te ajudar?`];

  if (contexto.treinoHoje && !contexto.treinoHoje.concluido) {
    partes.push(`Você tem treino hoje: ${contexto.treinoHoje.nome}`);
  }
  if (contexto.habitosPendentes.length > 0) {
    partes.push(`${contexto.habitosPendentes.length} hábito(s) pendente(s)`);
  }

  return {
    mensagem: partes.join('\n'),
    acoes: [
      { label: 'Resumo do dia', acao: 'COMANDO', payload: { comando: 'resumo do dia' } },
      { label: 'Meu treino', acao: 'COMANDO', payload: { comando: 'qual meu treino hoje?' } },
      { label: 'Meus hábitos', acao: 'COMANDO', payload: { comando: 'como estão meus hábitos?' } },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Fallback Inteligente
// ══════════════════════════════════════════════════════════════════════════════

function gerarRespostaGenerica(
  mensagem: string,
  contexto: ContextoUsuario,
): RespostaAgente {
  const norm = mensagem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const moduloDetectado = detectarModuloFallback(norm);

  if (moduloDetectado === 'agenda') {
    return {
      mensagem: 'Parece que tem a ver com a sua agenda! Quer criar um compromisso ou ver o que tem marcado?',
      acoes: [
        { label: 'Criar compromisso', acao: 'COMANDO', payload: { comando: 'criar compromisso' } },
        { label: 'Ver agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } },
      ],
    };
  }
  if (moduloDetectado === 'treino') {
    return {
      mensagem: 'Isso é sobre treinos! Quer ver seu treino de hoje ou criar um novo?',
      acoes: [
        { label: 'Meu treino', acao: 'COMANDO', payload: { comando: 'qual meu treino hoje?' } },
        { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
      ],
    };
  }
  if (moduloDetectado === 'habitos') {
    return {
      mensagem: 'Isso é sobre hábitos! Quer ver como estão seus hábitos ou criar um novo?',
      acoes: [
        { label: 'Meus hábitos', acao: 'COMANDO', payload: { comando: 'como estão meus hábitos?' } },
        { label: 'Ver Hábitos', acao: 'NAVEGAR', payload: { rota: '/habitos' } },
      ],
    };
  }
  if (moduloDetectado === 'financas') {
    return {
      mensagem: 'Isso é sobre finanças! Quer registrar um gasto ou ver seu resumo financeiro?',
      acoes: [
        { label: 'Resumo financeiro', acao: 'COMANDO', payload: { comando: 'como estão minhas finanças?' } },
        { label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } },
      ],
    };
  }

  return {
    mensagem: `Não entendi exatamente, ${contexto.nome}. Posso te ajudar com:\n\n` +
      `Treinos — "qual meu treino hoje?"\n` +
      `Agenda — "marcar entrevista dia 15"\n` +
      `Hábitos — "como estão meus hábitos?"\n` +
      `Finanças — "gastei R$ 50 no mercado"\n` +
      `Resumo — "resumo do dia"\n\n` +
      `Tente me dizer de outra forma!`,
    acoes: [
      { label: 'Resumo do dia', acao: 'COMANDO', payload: { comando: 'resumo do dia' } },
      { label: 'Ver Agenda', acao: 'NAVEGAR', payload: { rota: '/agenda' } },
      { label: 'Ver Treinos', acao: 'NAVEGAR', payload: { rota: '/treinos' } },
    ],
  };
}

function detectarModuloFallback(norm: string): string | null {
  const modulos: Record<string, string[]> = {
    agenda: ['agenda', 'compromisso', 'evento', 'reuniao', 'consulta', 'entrevista', 'festa', 'aniversario', 'marcar', 'agendar', 'calendario', 'prova', 'medico', 'dentista'],
    treino: ['treino', 'treinar', 'exercicio', 'academia', 'musculacao', 'peito', 'costas', 'perna', 'biceps', 'triceps', 'ombro'],
    habitos: ['habito', 'habitos', 'rotina', 'streak', 'consistencia', 'pendente'],
    financas: ['financa', 'financas', 'gasto', 'despesa', 'receita', 'dinheiro', 'saldo', 'orcamento', 'boleto', 'fatura', 'salario', 'paguei', 'gastei', 'comprei'],
  };

  for (const [modulo, palavras] of Object.entries(modulos)) {
    for (const palavra of palavras) {
      if (norm.includes(palavra)) return modulo;
    }
  }
  return null;
}
