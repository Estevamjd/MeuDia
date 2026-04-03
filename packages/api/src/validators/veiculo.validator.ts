import { z } from 'zod';

export const veiculoInsertSchema = z.object({
  modelo: z.string().min(1, 'Modelo é obrigatório').max(100),
  placa: z.string().max(20).optional(),
  ano: z.number().int().optional(),
  km_atual: z.number().int().min(0).default(0),
});

export const manutencaoInsertSchema = z.object({
  veiculo_id: z.string().uuid('ID do veículo inválido'),
  tipo: z.string().min(1, 'Tipo é obrigatório').max(100),
  data: z.string().min(1, 'Data é obrigatória').max(30),
  km_na_revisao: z.number().int().optional(),
  custo: z.number().optional(),
  proxima_revisao_km: z.number().int().optional(),
  observacao: z.string().max(1000).optional(),
});
