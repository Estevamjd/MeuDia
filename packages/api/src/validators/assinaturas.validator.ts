import { z } from 'zod';

export const assinaturaInsertSchema = z.object({
  nome: z.string().min(1, 'Nome da assinatura é obrigatório'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  dia_vencimento: z.number().int().min(1, 'Dia deve ser entre 1 e 31').max(31, 'Dia deve ser entre 1 e 31'),
  icone: z.string().default('💳'),
  cor: z.string().default('#7c6aff'),
});
