import 'server-only';
import { z } from 'zod';
import { chamarClaude } from './ia';
import { primeiroNome, type Contato } from './contato';
import type { Gancho } from './ganchos';
import type { IntencaoEscrita } from './intencao';
import type { Extras } from './servicos';
import type { ExtrairIA } from './onboarding';

export const REGRAS_DE_OURO = [
  'Humor de amigo: leve, carinhoso, uma provocação de brincadeira no máximo. Nunca maldoso, nunca sermão, nunca culpa.',
  'Nunca comente corpo, peso, aparência ou "gordice"; não chame comida de errada nem de pecado. Fale da META que a pessoa escolheu, não da pessoa.',
  'Varie as piadas: não repita bordões nem comece sempre igual.',
];

/**
 * Persona do assistente (Haiku 4.5). Segue o "SOUL" de uma página (livro 19 da Mestres Play): quem é,
 * idioma e tom, o que vem primeiro, o que fazer quando falta dado, limites e fuso.
 */
export function personaSystem(contato: Pick<Contato, 'nome' | 'objetivo' | 'metas' | 'estilo' | 'fatos'>, hojeISO: string): string {
  const nome = primeiroNome(contato.nome) || 'a pessoa';
  const metas = contato.metas.length ? contato.metas.join(', ') : 'não informado';
  return [
    `Você é o MeuDia, assistente pessoal com IA no WhatsApp de ${nome}, e fala como um amigo próximo e engraçado. Português do Brasil.`,
    'Tom: alegre, atencioso, prático e bem-humorado. Trate pelo primeiro nome. Nada de textão.',
    ...REGRAS_DE_OURO,
    contato.estilo.tamanho === 'detalhado'
      ? 'Tamanho: até 5 frases curtas, com o porquê quando ajudar.'
      : 'Tamanho: no máximo 2 frases curtas. A resposta vem primeiro.',
    contato.estilo.emoji ? 'Emoji: no máximo 1 por mensagem.' : 'Emoji: nunca use.',
    'Proativo ("faz antes de pedir"): termine sugerindo UM próximo passo útil e concreto, como um comando de exemplo.',
    'O que você faz: anota gastos ("gastei 30 no uber"), entradas ("recebi 500"), treinos ("treinei peito 40min") e refeições ("almocei arroz e frango"), e lembra o que a pessoa pedir ("lembra que não gosto de academia de manhã"); o resumo fica no app MeuDia.',
    'Limites: não move dinheiro, não acessa banco, não dá recomendação de investimento, diagnóstico médico nem dieta clínica; nesses casos, diga em uma frase e sugira um profissional.',
    'Se faltar um dado, faça uma pergunta só. Nunca invente números, saldos ou registros: você não vê os dados da conta nesta conversa.',
    `Objetivo de ${nome}: ${contato.objetivo ?? 'não informado'}. Quer ajuda com: ${metas}.`,
    contato.fatos.length ? `O que ${nome} já te contou: ${contato.fatos.join('; ')}.` : '',
    `Fuso America/Sao_Paulo. Hoje é ${hojeISO}.`,
  ].filter(Boolean).join('\n');
}

/** Resposta livre (só para conta ligada e mensagem que não é registro). Até ~200 tokens. */
export async function conversar(contato: Contato, mensagem: string, hojeISO: string, fetchFn?: typeof fetch): Promise<string | null> {
  const r = await chamarClaude({ uso: 'conversa', system: personaSystem(contato, hojeISO), mensagem, maxTokens: 200 }, fetchFn);
  return r?.tipo === 'texto' ? seguro(r.texto.slice(0, 700)) : null;
}

// ── Comentário com humor depois de um registro (só quando há gancho com a meta) ──

export const ANGULOS = [
  'como um amigo que percebeu e dá uma piscadinha',
  'com uma pergunta retórica divertida',
  'com um exagero cômico e carinhoso',
  'como narrador esportivo empolgado',
  'com um trocadilho leve',
  'com uma comparação bem-humorada do dia a dia',
];

const PEDIDO: Record<Gancho['motivo'], string> = {
  tentacao: 'Registrou algo gostoso que puxa contra a meta de alimentação. Brinque de leve lembrando a meta, sem proibir; no máximo sugira equilibrar na próxima.',
  saudavel: 'Registrou uma refeição que ajuda a meta de alimentação. Comemore com humor.',
  gasto_extra: 'Fez um gasto que não é essencial e tem meta de dinheiro. Cutuque de brincadeira lembrando a meta, sem julgar o gasto.',
  estourou: 'Passou do orçamento planejado dessa categoria no mês. Avise com humor e leveza, sem bronca.',
  sequencia: 'Está numa sequência de treinos na semana. Comemore como amigo empolgado.',
  voltou: 'Voltou a treinar depois de uma semana ou mais parado. Provoque de leve ("sumiu, hein") e comemore a volta.',
};

/** Palavras que nunca podem sair (se sair, cai no texto pronto). */
const PROIBIDO = /\b(?:gord|obes|baleia|porc[oa]|fei[oa]|vergonha|culpa|nojo|pecad|lixo|burr|preguic|fracass|desist|deveria)/i;

export function seguro(texto: string): string | null {
  const t = texto.replace(/^["'“]|["'”]$/g, '').trim();
  return t && !PROIBIDO.test(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? t : null;
}

/** Texto pronto (sem IA ou se a IA falhar/sair do tom). Vários por motivo para não repetir. */
export const COMENTARIOS_PRONTOS: Record<Gancho['motivo'], ((g: Gancho, meta: string) => string)[]> = {
  tentacao: [
    (g, m) => `${g.item}, é? Olha a meta de ${m} aí, hein 😅`,
    (_g, m) => `Anotei, mas a meta de ${m} viu tudo 👀`,
    (_g, m) => `Hoje teve recompensa! Amanhã a gente compensa pela meta de ${m} 😉`,
  ],
  saudavel: [() => 'Olha só, caprichando! Seu eu do futuro agradece 🥗', () => 'Isso que é parceria com a meta! 👏'],
  gasto_extra: [
    (_g, m) => `Anotado! Só não esquece do ${m}, hein 😅`,
    (_g, m) => `Esse aí a meta de ${m} sentiu um pouquinho 👀`,
  ],
  estourou: [(g) => `${g.item} passou do planejado do mês, hein! Bora segurar um pouco? 😬`],
  sequencia: [() => 'Tá on fire nessa semana! 🔥', () => 'Consistência de respeito, hein! 💪'],
  voltou: [() => 'Sumiu, hein! Mas voltou com tudo, é isso aí 💪', () => 'O filho pródigo voltou pro treino! 😄'],
};

function metaDoGancho(g: Gancho, contato: Pick<Contato, 'objetivo'>): string {
  const obj = contato.objetivo?.trim();
  if (obj && obj.length <= 40) return obj.toLowerCase();
  return g.tema === 'dieta' ? 'alimentação' : g.tema === 'dinheiro' ? 'guardar dinheiro' : 'treino';
}

export function comentarioPronto(g: Gancho, contato: Pick<Contato, 'objetivo'>, sorteio: () => number = Math.random): string {
  const opcoes = COMENTARIOS_PRONTOS[g.motivo];
  return opcoes[Math.floor(sorteio() * opcoes.length) % opcoes.length]!(g, metaDoGancho(g, contato));
}

export interface ContextoComentario {
  contato: Contato;
  intencao: IntencaoEscrita;
  gancho: Gancho;
  extras?: Extras;
  hojeISO: string;
}

/** O que a IA recebe: só fatos verdadeiros (do banco e do que a pessoa disse); nada de texto livre longo. */
export function contextoDoComentario({ contato, intencao, gancho, extras }: ContextoComentario): string {
  const linhas = [
    `Acabou de registrar: ${intencao.tipo}${'descricao' in intencao && intencao.descricao ? ` "${intencao.descricao}"` : ''}${'valor' in intencao && intencao.valor != null ? ` de R$ ${intencao.valor.toFixed(2).replace('.', ',')}` : ''}.`,
    `Objetivo: ${contato.objetivo ?? 'não informado'}. Metas: ${contato.metas.join(', ') || 'não informado'}.`,
  ];
  if (contato.fatos.length) linhas.push(`Já te contou: ${contato.fatos.slice(-5).join('; ')}.`);
  if (extras?.planejado != null && extras.gasto_mes != null) linhas.push(`Orçamento de ${extras.categoria}: planejado R$ ${extras.planejado}, gasto no mês R$ ${extras.gasto_mes}.`);
  if (extras?.treinos_semana) linhas.push(`Dias de treino nesta semana: ${extras.treinos_semana}.`);
  if (extras?.dias_sem_treino != null) linhas.push(`Dias desde o treino anterior: ${extras.dias_sem_treino}.`);
  const recentes = (extras?.recentes ?? []).slice(1, 5).map((r) => `${r.tipo}${r.descricao ? ` ${r.descricao}` : ''}${r.valor != null ? ` R$ ${r.valor}` : ''}`);
  if (recentes.length) linhas.push(`Registros recentes (7 dias): ${recentes.join('; ')}.`);
  linhas.push(`Situação: ${PEDIDO[gancho.motivo]}`);
  return linhas.join('\n');
}

/**
 * Uma frase curta e engraçada sobre o registro x meta (Haiku, até 80 tokens). Sem chave, com erro ou fora do tom,
 * usa um texto pronto. A confirmação com os números continua vindo das regras.
 */
export async function comentarComHumor(c: ContextoComentario, fetchFn?: typeof fetch, sorteio: () => number = Math.random): Promise<string> {
  const nome = primeiroNome(c.contato.nome) || 'a pessoa';
  const angulo = ANGULOS[Math.floor(sorteio() * ANGULOS.length) % ANGULOS.length];
  const r = await chamarClaude(
    {
      uso: 'comentario',
      system: [
        `Você é o MeuDia, amigo engraçado de ${nome} no WhatsApp. Português do Brasil, informal.`,
        ...REGRAS_DE_OURO,
        `Escreva UMA frase curta (até 20 palavras) comentando o registro, ${angulo}. Cite a meta dela com as palavras dela. Use o nome só de vez em quando (nem sempre no começo).`,
        'Português correto e natural, como mensagem de amigo no WhatsApp.',
        'Não repita a confirmação nem valores; não invente números nem fatos além dos dados.',
        c.contato.estilo.emoji ? 'Pode usar 1 emoji.' : 'Não use emoji.',
        'Responda só a frase, sem aspas.',
      ].join('\n'),
      mensagem: contextoDoComentario(c),
      maxTokens: 80,
    },
    fetchFn,
  );
  const texto = r?.tipo === 'texto' ? seguro(r.texto.split('\n')[0]!.slice(0, 220)) : null;
  return texto ?? comentarioPronto(c.gancho, c.contato, sorteio);
}

const PERGUNTAS = {
  nome: 'Como você quer que eu te chame?',
  renda: 'Quanto você recebe por mês, mais ou menos?',
  metas: 'Em que quer ajuda: dinheiro, treino, dieta?',
  estilo: 'Prefere respostas curtas ou detalhadas? Com ou sem emoji?',
} as const;

const extraido = z.object({
  nome: z.string().min(1).max(60).optional(),
  renda: z.number().positive().max(10_000_000).optional(),
  metas: z.array(z.enum(['dinheiro', 'treino', 'dieta'])).optional(),
  estilo_tamanho: z.enum(['curto', 'detalhado']).optional(),
  estilo_emoji: z.boolean().optional(),
});

/** Entende a resposta do onboarding quando a regra não entendeu (até ~100 tokens). */
export const extrairOnboardingIA: ExtrairIA = async (etapa, texto) => {
  const r = await chamarClaude({
    uso: 'onboarding',
    system:
      `Você extrai dados da resposta de uma pessoa à pergunta de cadastro: "${PERGUNTAS[etapa]}". ` +
      'Preencha só o campo da pergunta e só se a resposta disser claramente; senão, deixe vazio. Valores em reais (3 mil = 3000). ' +
      'Nome: só o nome ou apelido, sem frases. Chame a ferramenta extrair.',
    mensagem: texto,
    maxTokens: 100,
    ferramenta: {
      name: 'extrair',
      description: 'Dados extraídos da resposta.',
      input_schema: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          renda: { type: 'number' },
          metas: { type: 'array', items: { type: 'string', enum: ['dinheiro', 'treino', 'dieta'] } },
          estilo_tamanho: { type: 'string', enum: ['curto', 'detalhado'] },
          estilo_emoji: { type: 'boolean' },
        },
      },
    },
  });
  if (r?.tipo !== 'ferramenta') return null;
  const p = extraido.safeParse(r.input);
  return p.success ? p.data : null;
};
