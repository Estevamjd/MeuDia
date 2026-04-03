import { z } from 'zod';

export const medicamentoInsertSchema = z.object({
  nome: z.string().min(1, 'Nome do medicamento é obrigatório'),
  dosagem: z.string().min(1, 'Dosagem é obrigatória'),
  frequencia: z.string().min(1, 'Frequência é obrigatória'),
  horarios: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Formato de horário inválido (HH:MM)')).min(1, 'Pelo menos um horário é obrigatório'),
  estoque_atual: z.number().int().min(0, 'Estoque não pode ser negativo').default(0),
  estoque_minimo: z.number().int().min(0, 'Estoque mínimo não pode ser negativo').default(5),
});
