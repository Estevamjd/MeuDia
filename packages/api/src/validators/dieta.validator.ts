import { z } from 'zod';

const itemRefeicaoSchema = z.object({
  nome: z.string().min(1, 'Nome do item é obrigatório'),
  calorias: z.number().min(0),
  proteina: z.number().min(0).optional(),
  carbo: z.number().min(0).optional(),
  gordura: z.number().min(0).optional(),
  quantidade: z.number().min(0).optional(),
});

export const refeicaoInsertSchema = z.object({
  tipo: z.enum(['cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia']),
  data: z.string().optional(),
  items: z.array(itemRefeicaoSchema).min(1, 'Adicione pelo menos um item'),
  total_calorias: z.number().min(0).optional(),
  total_proteina: z.number().min(0).optional(),
  total_carbo: z.number().min(0).optional(),
  total_gordura: z.number().min(0).optional(),
});

export const registroPesoInsertSchema = z.object({
  peso: z.number().min(0.1, 'Peso deve ser maior que zero'),
  data: z.string().optional(),
  observacao: z.string().nullable().optional(),
});

export const registroAguaSchema = z.object({
  data: z.string().optional(),
  copos_bebidos: z.number().min(0).optional(),
  meta_copos: z.number().min(1).optional(),
});
