import 'server-only';
import { z } from 'zod';
import { CATEGORIAS_GASTO, CATEGORIA_ENTRADA_EXTRA, CATEGORIA_SALARIO, TIPOS_REFEICAO_RAPIDA } from '@meudia/shared';
import { chamarClaude } from './ia';
import type { Intencao } from './intencao';

/** Claude Haiku 4.5 só para o que as regras não entenderam (barato: ~1 chamada curta por mensagem estranha). */

const saida = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.enum(['gasto', 'entrada']), valor: z.number().positive().max(1_000_000), descricao: z.string().max(200).default(''), categoria: z.string().max(40), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ tipo: z.literal('treino'), descricao: z.string().min(1).max(120), duracao_min: z.number().int().min(1).max(600).nullable().default(null), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ tipo: z.literal('refeicao'), refeicao: z.enum(['cafe', 'almoco', 'lanche', 'jantar', 'ceia']), descricao: z.string().min(1).max(200), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ tipo: z.literal('ajuda') }),
  z.object({ tipo: z.literal('desconhecido') }),
]);

const CATEGORIAS = [...CATEGORIAS_GASTO.map((c) => c.nome), CATEGORIA_SALARIO, CATEGORIA_ENTRADA_EXTRA];

function prompt(hojeISO: string): string {
  return [
    'Você interpreta mensagens curtas de WhatsApp de um app pessoal (finanças, treino, refeições) em português do Brasil.',
    `Hoje é ${hojeISO} (America/Sao_Paulo). Use "data" só se a pessoa disser outro dia (ex.: ontem).`,
    `Categorias válidas: ${CATEGORIAS.join(', ')}. Na dúvida, Outros (gasto) ou ${CATEGORIA_ENTRADA_EXTRA} (entrada).`,
    `Refeições: ${TIPOS_REFEICAO_RAPIDA.map((t) => `${t.tipo}=${t.rotulo}`).join(', ')}.`,
    'Se não for um registro claro, responda tipo "desconhecido". Nunca invente valores. Chame a ferramenta registrar.',
  ].join('\n');
}

const FERRAMENTA = {
  name: 'registrar',
  description: 'Devolve a intenção estruturada da mensagem.',
  input_schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['gasto', 'entrada', 'treino', 'refeicao', 'ajuda', 'desconhecido'] },
      valor: { type: 'number' },
      descricao: { type: 'string' },
      categoria: { type: 'string', enum: CATEGORIAS },
      duracao_min: { type: 'integer' },
      refeicao: { type: 'string', enum: ['cafe', 'almoco', 'lanche', 'jantar', 'ceia'] },
      data: { type: 'string', description: 'AAAA-MM-DD' },
    },
    required: ['tipo'],
  },
} as const;

export async function interpretarComClaude(mensagem: string, hojeISO: string, fetchFn: typeof fetch = fetch): Promise<Intencao | null> {
  const r = await chamarClaude({ uso: 'interpretar', temperatura: 0, system: prompt(hojeISO), mensagem, maxTokens: 200, ferramenta: FERRAMENTA as never }, fetchFn);
  if (r?.tipo !== 'ferramenta') return null;
  const parsed = saida.safeParse(r.input);
  if (!parsed.success) {
    console.warn('[whatsapp/ia] fallback motivo=saida_invalida');
    return null;
  }
  return parsed.data as Intencao;
}
