import { z } from 'zod';

export const compromissoInsertSchema = z.object({
  titulo: z.string().min(1, 'Titulo do compromisso e obrigatorio').max(200),
  descricao: z.string().max(2000).nullable().optional(),
  data_inicio: z.string().min(1, 'Data de inicio e obrigatoria').max(30),
  data_fim: z.string().max(30).nullable().optional(),
  local: z.string().max(300).nullable().optional(),
  tipo: z.string().max(50).default('geral'),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
  concluido: z.boolean().default(false),
});
