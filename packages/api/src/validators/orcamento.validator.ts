import { z } from 'zod';

export const orcamentoInsertSchema = z.object({
  categoria: z.string().min(1).max(100),
  valor_planejado: z.number().nonnegative().multipleOf(0.01).max(99999999.99),
});
