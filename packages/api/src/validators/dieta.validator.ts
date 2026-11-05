import { z } from 'zod';

// Nutriente null = "sem valor" (fora da TACO, "NA", "Tr", "*" ou vazio): nunca vira 0.
const nutriente = z.number().min(0).nullable();

const itemRefeicaoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do item é obrigatório').max(120),
  calorias: nutriente,
  proteina: nutriente.optional(),
  carbo: nutriente.optional(),
  gordura: nutriente.optional(),
  quantidade: nutriente.optional(),
  fonte: z.enum(['taco', 'rotulo', 'manual']).optional(),
  taco_id: z.number().int().positive().nullable().optional(),
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
  // registros_peso.peso é DECIMAL(5,2).
  peso: z.number().min(0.1, 'Peso deve ser maior que zero').max(999.99),
  data: z.string().optional(),
  observacao: z.string().nullable().optional(),
});

export const registroAguaSchema = z.object({
  data: z.string().optional(),
  quantidade_ml: z.number().int().min(0).optional(),
  meta_ml: z.number().int().min(1).optional(),
});
