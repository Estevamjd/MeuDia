import { z } from 'zod';
import { ICONES_META } from '@meudia/shared';
import { dataISOSchema } from './contas-pagar.validator';

// Limites do DECIMAL(12,2) e CHECKs de public.metas (007).
const valor = z.number().multipleOf(0.01).max(9999999999.99);

export const metaInsertSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').max(80),
  icone: z.enum(ICONES_META).nullable().optional(),
  valor_alvo: valor.positive('Informe um valor maior que zero'),
  data_limite: dataISOSchema.nullable().optional(),
});

/** Editar a meta ou corrigir o valor guardado (absoluto). */
export const metaUpdateSchema = metaInsertSchema.extend({ valor_guardado: valor.min(0) }).partial();

/** "Guardei": quanto somar. */
export const valorGuardadoSchema = valor.positive('Informe um valor maior que zero');
