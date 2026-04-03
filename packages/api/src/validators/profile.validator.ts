import { z } from 'zod';

export const profileUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  avatar_url: z.string().url().nullable().optional(),
  peso_atual: z.number().min(20).max(300).nullable().optional(),
  altura: z.number().min(0.5).max(2.5).nullable().optional(),
  meta_peso: z.number().min(20).max(300).nullable().optional(),
  meta_calorias: z.number().min(500).max(10000).optional(),
  meta_agua: z.number().min(1).max(30).optional(),
  objetivo: z.enum(['saude_geral', 'emagrecer', 'ganhar_massa', 'condicionamento']).nullable().optional(),
  onboarding_feito: z.boolean().optional(),
});
