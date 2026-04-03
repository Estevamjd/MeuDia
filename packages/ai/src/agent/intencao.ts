import type { Intencao, TipoIntencao } from '@meudia/shared';

// ══════════════════════════════════════════════════════════════════════════════
// Padrões de intenção por regex (sem dependência de API externa)
// ══════════════════════════════════════════════════════════════════════════════

const PADROES_INTENCAO: Record<TipoIntencao, RegExp[]> = {
  CONSULTA_TREINO: [
    /treino.*hoje/i,
    /hoje.*treino/i,
    /qual.*treino/i,
    /meu treino/i,
    /levantei.*(?:supino|agachamento|rosca|remada|puxada)/i,
    /carga.*exerc[ií]cio/i,
    /quanto.*(?:supino|agachamento|rosca)/i,
    /evolu[íi].*treino/i,
    /desempenho.*treino/i,
    /hist[oó]rico.*treino/i,
    /como.*(?:est[aá]|anda|vai).*treino/i,
  ],
  CRIAR_TREINO: [
    /cri(?:a|e|ar).*treino/i,
    /mont(?:a|e|ar).*treino/i,
    /fa(?:z|ça|zer).*treino/i,
    /novo.*treino/i,
    /treino.*(?:para|de)\s+(?:costas|peito|pernas?|b[ií]ceps|tr[ií]ceps|ombro|gl[úu]teo)/i,
    /gerar.*treino/i,
    /sugir(?:a|e).*treino/i,
    /preciso.*treino/i,
    /quero.*treino/i,
  ],
  AGENDAR_TREINO: [
    /agend(?:a|e|ar).*treino/i,
    /treino.*calend[aá]rio/i,
    /marc(?:a|e|ar).*treino/i,
    /program(?:a|e|ar).*treino/i,
    /treino.*(?:segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo)/i,
    /registr(?:a|e|ar).*treino.*calend/i,
  ],
  CONSULTA_HABITOS: [
    /h[aá]bito/i,
    /streak/i,
    /consist[eê]ncia/i,
    /marquei/i,
    /n[aã]o marquei/i,
    /h[aá]bitos.*pend/i,
    /falt(?:a|am).*marcar/i,
    /como.*(?:est[aá]|anda).*h[aá]bito/i,
  ],
  CONSULTA_AGENDA: [
    /amanh[aã]/i,
    /compromisso/i,
    /(?:essa|esta|pr[oó]xima).*semana/i,
    /o que tenho/i,
    /minha agenda/i,
    /calend[aá]rio/i,
    /(?:ver|mostrar|abrir).*agenda/i,
    /agenda.*(?:hoje|amanh|semana)/i,
    /tenho.*(?:marcado|agendado)/i,
  ],
  CONSULTA_FINANCAS: [
    /gastei/i,
    /or[çc]amento/i,
    /assinatura/i,
    /finan[çc]/i,
    /dinheiro/i,
    /quanto.*(?:gast|sobr)/i,
    /saldo/i,
    /despesa/i,
    /receita/i,
    /como.*(?:est[aá]|anda).*finan/i,
  ],
  RESUMO_DIA: [
    /resumo/i,
    /como foi/i,
    /dia.*hoje/i,
    /o que fiz/i,
    /balan[çc]o/i,
    /como.*est[aá].*meu dia/i,
    /o que.*foc/i,
    /resumo.*semana/i,
  ],
  CRIAR_COMPROMISSO: [
    /cri(?:a|e|ar).*(?:agenda|compromisso|evento|reuni[aã]o|consulta)/i,
    /fa(?:z|ça|zer).*(?:agenda|compromisso|evento|reuni[aã]o|consulta)/i,
    /mont(?:a|e|ar).*(?:agenda|compromisso|evento)/i,
    /marc(?:a|e|ar).*(?:compromisso|evento|reuni[aã]o|consulta|festa|anivers[aá]rio|entrevista)/i,
    /agend(?:a|e|ar).*(?:compromisso|evento|reuni[aã]o|consulta|festa|entrevista)/i,
    /adicion(?:a|e|ar).*(?:agenda|compromisso|evento)/i,
    /(?:nova|novo).*(?:reuni[aã]o|consulta|evento|compromisso)/i,
    /(?:tenho|vou ter|preciso|quero).*(?:reuni[aã]o|consulta|evento|festa|entrevista|prova|m[eé]dico|dentista).*(?:dia|no|\d)/i,
    /(?:tenho|vou ter|preciso|quero).*(?:dia|no)\s*\d.*(?:reuni[aã]o|consulta|evento|festa|entrevista|prova)/i,
    /(?:festa|anivers[aá]rio|casamento|formatura|churrasco|entrevista|prova|consulta|m[eé]dico|dentista).*(?:dia|data|\d)/i,
    /(?:dia|\d+\s*(?:de|\/)).*(?:festa|anivers[aá]rio|casamento|entrevista|prova|reuni[aã]o|consulta)/i,
    /fa(?:z|ça|zer).*agenda.*(?:dia|para)/i,
    /agenda.*(?:dia|para).*\d/i,
    /(?:preciso|quero|need).*(?:marc|agend|cri).*(?:dia|\d)/i,
    /(?:dia|data)\s*\d+.*(?:de\s+\w+)?\s+(?:tenho|vou|preciso|quero|fazer|ir)/i,
  ],
  CRIAR_HABITO: [
    /cri(?:a|e|ar).*h[aá]bito/i,
    /fa(?:z|ça|zer).*h[aá]bito/i,
    /(?:novo|nova).*h[aá]bito/i,
    /adicion(?:a|e|ar).*h[aá]bito/i,
    /quero.*(?:come[çc]ar|criar|adicionar).*(?:h[aá]bito|rotina)/i,
    /(?:come[çc]ar|passar)\s+a\s+(?:ler|meditar|correr|treinar|estudar|dormir|beber)/i,
  ],
  CRIAR_TRANSACAO: [
    /(?:gastei|paguei|comprei).*(?:R?\$?\s*\d|real|reais)/i,
    /(?:gastei|paguei|comprei)\s+\d/i,
    /(?:gastei|paguei|comprei)\s+(?:no|na|em|o|a)\s+/i,
    /(?:recebi|ganhei|entrou)\s+(?:R?\$?\s*\d|\d)/i,
    /registr(?:a|e|ar).*(?:gasto|despesa|receita|pagamento)/i,
    /(?:conta|boleto|fatura|aluguel|sal[aá]rio).*(?:R?\$?\s*\d|\d)/i,
    /R\$\s*\d+/i,
  ],
  CONSULTA_NOTAS: [
    /(?:minhas?\s+)?notas?/i,
    /bloco\s*(?:de\s+)?notas?/i,
    /anota[çc][oõ]es/i,
    /(?:ver|abrir|mostrar).*notas?/i,
  ],
  SAUDACAO: [
    /^(?:oi|ol[aá]|hey|e\s*a[ií]|fala|salve|opa)[\s!.,?]*$/i,
    /^(?:bom\s*dia|boa\s*tarde|boa\s*noite)[\s!.,?]*$/i,
    /^(?:tudo\s*bem|como\s*vai|beleza)[\s!.,?]*$/i,
  ],
  GENERICA: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const VERBOS_CRIACAO =
  /^(?:cri(?:a|e|ar)|fa(?:z|ça|zer|zendo)|mont(?:a|e|ar)|adicion(?:a|e|ar)|marc(?:a|e|ar)|agend(?:a|e|ar)|nov[oa]|registr(?:a|e|ar)|coloc(?:a|e|ar)|bot(?:a|e|ar)|quero|preciso|gostaria)/i;

const MAPA_CRIACAO: Record<string, TipoIntencao> = {
  treino: 'CRIAR_TREINO',
  treinar: 'CRIAR_TREINO',
  exercicio: 'CRIAR_TREINO',
  agenda: 'CRIAR_COMPROMISSO',
  compromisso: 'CRIAR_COMPROMISSO',
  evento: 'CRIAR_COMPROMISSO',
  reuniao: 'CRIAR_COMPROMISSO',
  consulta: 'CRIAR_COMPROMISSO',
  entrevista: 'CRIAR_COMPROMISSO',
  festa: 'CRIAR_COMPROMISSO',
  aniversario: 'CRIAR_COMPROMISSO',
  prova: 'CRIAR_COMPROMISSO',
  medico: 'CRIAR_COMPROMISSO',
  dentista: 'CRIAR_COMPROMISSO',
  habito: 'CRIAR_HABITO',
  habitos: 'CRIAR_HABITO',
  rotina: 'CRIAR_HABITO',
  gasto: 'CRIAR_TRANSACAO',
  despesa: 'CRIAR_TRANSACAO',
  receita: 'CRIAR_TRANSACAO',
  pagamento: 'CRIAR_TRANSACAO',
};

const PALAVRAS_MODULO: Record<string, TipoIntencao> = {
  treino: 'CONSULTA_TREINO',
  treinar: 'CONSULTA_TREINO',
  exercicio: 'CONSULTA_TREINO',
  academia: 'CONSULTA_TREINO',
  habito: 'CONSULTA_HABITOS',
  habitos: 'CONSULTA_HABITOS',
  rotina: 'CONSULTA_HABITOS',
  agenda: 'CONSULTA_AGENDA',
  compromisso: 'CONSULTA_AGENDA',
  calendario: 'CONSULTA_AGENDA',
  financa: 'CONSULTA_FINANCAS',
  financas: 'CONSULTA_FINANCAS',
  gasto: 'CONSULTA_FINANCAS',
  gastos: 'CONSULTA_FINANCAS',
  dinheiro: 'CONSULTA_FINANCAS',
  nota: 'CONSULTA_NOTAS',
  notas: 'CONSULTA_NOTAS',
  anotacao: 'CONSULTA_NOTAS',
};

// ══════════════════════════════════════════════════════════════════════════════
// Classificação de intenção
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Classifica a intenção de uma mensagem do usuário usando padrões regex.
 * Se regex falhar, usa fallback por palavras-chave.
 */
export function classificarIntencao(mensagem: string): Intencao {
  const original = mensagem.trim();
  const norm = normalizar(original);

  // Etapa 1: Regex direto (alta confiança)
  for (const [tipo, padroes] of Object.entries(PADROES_INTENCAO)) {
    if (tipo === 'GENERICA') continue;
    const match = padroes.some((p) => p.test(original) || p.test(norm));
    if (match) {
      return {
        tipo: tipo as TipoIntencao,
        confianca: 0.85,
        parametros: extrairParametros(original),
      };
    }
  }

  // Etapa 2: Fallback — verbo de criação + módulo
  const palavras = norm.split(/\s+/);
  const temVerboCriacao = VERBOS_CRIACAO.test(norm);

  if (temVerboCriacao) {
    for (const palavra of palavras) {
      if (MAPA_CRIACAO[palavra]) {
        return {
          tipo: MAPA_CRIACAO[palavra],
          confianca: 0.7,
          parametros: extrairParametros(original),
        };
      }
    }
  }

  // Etapa 3: Fallback — palavra-chave de módulo (consulta)
  for (const palavra of palavras) {
    if (PALAVRAS_MODULO[palavra]) {
      return {
        tipo: PALAVRAS_MODULO[palavra],
        confianca: 0.6,
        parametros: extrairParametros(original),
      };
    }
  }

  // Etapa 4: Data + atividade = provavelmente compromisso
  const temData =
    /(?:\d{1,2}\s*(?:\/|de)\s*(?:\d{1,2}|\w+)|dia\s*\d|amanh[aã]|segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo)/i.test(
      original,
    );
  const temAtividade =
    /(?:entrevista|reuni[aã]o|consulta|m[eé]dico|dentista|festa|prova|aula|trabalho|viagem|casamento|formatura|anivers[aá]rio|churrasco)/i.test(
      original,
    );

  if (temData && temAtividade) {
    return {
      tipo: 'CRIAR_COMPROMISSO',
      confianca: 0.65,
      parametros: extrairParametros(original),
    };
  }

  return { tipo: 'GENERICA', confianca: 0.0 };
}

// ══════════════════════════════════════════════════════════════════════════════
// Extração de parâmetros
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Extrai parâmetros relevantes de uma mensagem (data, hora, assunto, etc.)
 */
export function extrairParametros(mensagem: string): Record<string, string> {
  const params: Record<string, string> = {};
  const norm = normalizar(mensagem);

  // Data: "dia 22", "22 de junho", "dia 22 de abril"
  const matchDia = mensagem.match(
    /(?:dia|para o dia|no dia|em|para)\s*(\d{1,2})(?:\s*(?:de|\/)\s*(\w+|\d{1,2}))?/i,
  );
  if (matchDia?.[1]) {
    params.dia = matchDia[1];
    if (matchDia[2]) params.mes = matchDia[2];
  }

  // Data numérica: "22/06", "22-06"
  const matchDataNum = mensagem.match(/(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?/);
  if (matchDataNum?.[1] && !params.dia) {
    params.dia = matchDataNum[1];
    if (matchDataNum[2]) params.mes = matchDataNum[2];
    if (matchDataNum[3]) params.ano = matchDataNum[3];
  }

  // Dia da semana
  const matchDiaSemana = mensagem.match(
    /(?:segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:\s*-?\s*feira)?/i,
  );
  if (matchDiaSemana?.[0]) params.diaSemana = matchDiaSemana[0];

  // Amanhã
  if (/amanh[aã]/i.test(mensagem)) params.dia = 'amanha';

  // Hora: "às 14h", "14:00", "10h30"
  const matchHora = mensagem.match(
    /(?:[àa]s?\s*)?(\d{1,2})(?::(\d{2})|h(\d{2})?)\s*(?:da\s*(manh[aã]|tarde|noite))?/i,
  );
  if (matchHora?.[1]) {
    let hora = parseInt(matchHora[1], 10);
    const minutos = matchHora[2] ?? matchHora[3] ?? '00';
    if (matchHora[4]) {
      const periodo = normalizar(matchHora[4]);
      if ((periodo === 'tarde' || periodo === 'noite') && hora < 12) hora += 12;
    }
    params.hora = `${hora}:${minutos}`;
  }

  // Assunto / tipo do compromisso
  const assuntos = [
    'entrevista', 'reuniao', 'reunião', 'consulta', 'medico', 'médico',
    'dentista', 'festa', 'aniversario', 'aniversário', 'casamento',
    'formatura', 'churrasco', 'prova', 'aula', 'trabalho', 'viagem',
    'treino', 'academia',
  ];
  for (const assunto of assuntos) {
    if (norm.includes(normalizar(assunto))) {
      params.assunto = assunto;
      break;
    }
  }

  // Grupo muscular (treinos)
  const matchGrupo = mensagem.match(
    /(?:costas|peito|pernas?|b[ií]ceps|tr[ií]ceps|ombro|gl[úu]teo|abd[oô]men|cardio)/i,
  );
  if (matchGrupo?.[0]) params.grupoMuscular = matchGrupo[0].toLowerCase();

  // Nível (treinos)
  const matchNivel = mensagem.match(
    /(?:iniciante|intermedi[aá]rio|avan[çc]ado|leve|moderado|intenso|pesado)/i,
  );
  if (matchNivel?.[0]) params.nivel = matchNivel[0].toLowerCase();

  // Valor monetário
  const matchValor = mensagem.match(/R?\$?\s*(\d+(?:[.,]\d{1,2})?)/);
  if (matchValor?.[1]) params.valor = matchValor[1].replace(',', '.');

  // Descrição de gasto
  const matchDescGasto = mensagem.match(
    /(?:gastei|paguei|comprei)\s+(?:(?:no|na|em|o|a)\s+)?(.+?)(?:\s+(?:R?\$|no valor|por|de)\s|\s*$)/i,
  );
  if (matchDescGasto?.[1]) params.descricao = matchDescGasto[1].trim();

  return params;
}

/**
 * Alias para extrairParametros (compatibilidade com chat.ts).
 */
export function extrairParametrosData(mensagem: string): Record<string, string> {
  return extrairParametros(mensagem);
}
