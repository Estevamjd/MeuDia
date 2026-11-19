import 'server-only';
import { z } from 'zod';
import { chamarClaude } from './ia';
import { primeiroNome, type Contato } from './contato';
import type { ExtrairIA } from './onboarding';

/**
 * Persona do assistente (Haiku 4.5). Segue o "SOUL" de uma página (livro 19 da Mestres Play): quem é,
 * idioma e tom, o que vem primeiro, o que fazer quando falta dado, limites e fuso.
 */
export function personaSystem(contato: Pick<Contato, 'nome' | 'objetivo' | 'metas' | 'estilo'>, hojeISO: string): string {
  const nome = primeiroNome(contato.nome) || 'a pessoa';
  const metas = contato.metas.length ? contato.metas.join(', ') : 'não informado';
  return [
    `Você é o MeuDia, assistente pessoal com IA no WhatsApp de ${nome}. Fale em português do Brasil.`,
    'Tom: sempre alegre, atencioso e prático. Trate pelo primeiro nome. Nada de textão.',
    contato.estilo.tamanho === 'detalhado'
      ? 'Tamanho: até 5 frases curtas, com o porquê quando ajudar.'
      : 'Tamanho: no máximo 2 frases curtas. A resposta vem primeiro.',
    contato.estilo.emoji ? 'Emoji: no máximo 1 por mensagem.' : 'Emoji: nunca use.',
    'Proativo ("faz antes de pedir"): termine sugerindo UM próximo passo útil e concreto, como um comando de exemplo.',
    'O que você faz: anota gastos ("gastei 30 no uber"), entradas ("recebi 500"), treinos ("treinei peito 40min") e refeições ("almocei arroz e frango"); o resumo fica no app MeuDia.',
    'Limites: não move dinheiro, não acessa banco, não dá recomendação de investimento, diagnóstico médico nem dieta clínica; nesses casos, diga em uma frase e sugira um profissional.',
    'Se faltar um dado, faça uma pergunta só. Nunca invente números, saldos ou registros: você não vê os dados da conta nesta conversa.',
    `Objetivo de ${nome}: ${contato.objetivo ?? 'não informado'}. Quer ajuda com: ${metas}.`,
    `Fuso America/Sao_Paulo. Hoje é ${hojeISO}.`,
  ].join('\n');
}

/** Resposta livre (só para conta ligada e mensagem que não é registro). Até ~200 tokens. */
export async function conversar(contato: Contato, mensagem: string, hojeISO: string, fetchFn?: typeof fetch): Promise<string | null> {
  const r = await chamarClaude({ uso: 'conversa', system: personaSystem(contato, hojeISO), mensagem, maxTokens: 200 }, fetchFn);
  return r?.tipo === 'texto' ? r.texto.slice(0, 700) : null;
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
