import { z } from 'zod';

export const orcamentoInsertSchema = z.object({
  categoria: z.string().min(1).max(100),
  valor_planejado: z.number().nonnegative(),
});
