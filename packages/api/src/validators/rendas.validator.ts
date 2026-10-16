import { z } from 'zod';

export const rendaInsertSchema = z.object({
  descricao: z.string().min(1).max(500),
  valor: z.number().positive(),
  dia_recebimento: z.number().int().min(1).max(31).nullable().optional(),
  ativo: z.boolean().default(true),
});
