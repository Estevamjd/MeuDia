import { z } from 'zod';

export const habitoInsertSchema = z.object({
  nome: z.string().min(1, 'Nome do hábito é obrigatório').max(100),
  icone: z.string().max(10).default('✅'),
  frequencia: z.enum(['diario', 'semanal']).default('diario'),
  dias_semana: z.array(z.number().min(0).max(6).transform(n => n as 0|1|2|3|4|5|6)).default([0,1,2,3,4,5,6]),
  meta: z.number().min(1).default(1),
  ordem: z.number().optional(),
});

export const registroHabitoSchema = z.object({
  habito_id: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido').optional(),
  concluido: z.boolean().default(false),
  valor: z.number().min(0).default(1),
});
