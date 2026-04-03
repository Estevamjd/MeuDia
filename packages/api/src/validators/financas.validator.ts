import { z } from 'zod';

export const transacaoInsertSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoria: z.string().min(1, 'Categoria é obrigatória').max(100),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(500),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido').optional(),
  banco: z.string().max(100).nullable().optional(),
  automatico: z.boolean().optional(),
});
