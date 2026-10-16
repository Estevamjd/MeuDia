import { z } from 'zod';

export const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const dataISOSchema = z.string().date();

export const contaPagarFieldsSchema = z.object({
  assinatura_id: z.string().uuid().nullable().optional(),
  descricao: z.string().min(1).max(500),
  categoria: z.string().min(1).max(100).default('Contas'),
  valor: z.number().positive(),
  recorrencia: z.enum(['mensal', 'anual', 'unica']),
  dia_vencimento: z.number().int().min(1).max(31).nullable().optional(),
  mes_vencimento: z.number().int().min(1).max(12).nullable().optional(),
  data_vencimento: dataISOSchema.nullable().optional(),
  ativo: z.boolean().default(true),
});

export const contaPagarInsertSchema = contaPagarFieldsSchema.superRefine((conta, ctx) => {
  const dia = conta.dia_vencimento != null;
  const mes = conta.mes_vencimento != null;
  const data = conta.data_vencimento != null;
  const valido = conta.recorrencia === 'mensal' ? dia && !mes && !data
    : conta.recorrencia === 'anual' ? dia && mes && !data : data && !dia && !mes;
  if (!valido) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vencimento incompatível com a recorrência', path: ['recorrencia'] });
});

// Sem defaults no patch; a coerência é validada com a definição atual no service.
export const contaPagarUpdateSchema = contaPagarFieldsSchema.partial();

export const pagarContaSchema = z.object({
  competencia: competenciaSchema,
  pago_em: dataISOSchema.optional(),
  banco: z.string().max(100).nullable().optional(),
});
