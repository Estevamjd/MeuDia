import { z } from 'zod';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export const registroTreinoInsertSchema = z.object({
  descricao: z.string().trim().min(1, 'Diga o que treinou').max(120, 'Use até 120 letras'),
  duracao_min: z.number().int().min(1).max(600).nullable().optional(),
  data: dataISO,
});

export const registroRefeicaoInsertSchema = z.object({
  tipo: z.enum(['cafe', 'almoco', 'lanche', 'jantar', 'ceia']),
  descricao: z.string().trim().min(1, 'Diga o que comeu').max(200, 'Use até 200 letras'),
  data: dataISO,
});
