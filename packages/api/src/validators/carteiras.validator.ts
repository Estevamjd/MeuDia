import { z } from 'zod';
import { competenciaSchema, dataISOSchema } from './contas-pagar.validator';

const valorPositivo = z.number().positive('Informe um valor maior que zero').multipleOf(0.01).max(99999999.99);
const nomeCarteira = z.string().trim().min(1, 'Informe o nome').max(60);

export const tipoCarteiraSchema = z.enum(['banco', 'dinheiro', 'poupanca']);

export const carteiraInsertSchema = z.object({
  nome: nomeCarteira,
  tipo: tipoCarteiraSchema.default('banco'),
  // Aceita negativo (cheque especial). Limite do DECIMAL(12,2).
  saldo_inicial: z.number().multipleOf(0.01).min(-9999999999.99).max(9999999999.99).default(0),
  incluir_no_total: z.boolean().default(true),
  ordem: z.number().int().min(0).optional(),
});

// Saldo não é editável: correção vira ajuste (R9). Sem defaults no patch.
export const carteiraUpdateSchema = z.object({
  nome: nomeCarteira,
  tipo: tipoCarteiraSchema,
  incluir_no_total: z.boolean(),
  arquivada: z.boolean(),
  ordem: z.number().int().min(0),
}).partial();

export const transferenciaInsertSchema = z.object({
  origem_id: z.string().uuid(),
  destino_id: z.string().uuid(),
  valor: valorPositivo,
  data: dataISOSchema,
  descricao: z.string().trim().max(200).nullable().optional(),
}).refine((t) => t.origem_id !== t.destino_id, { message: 'Origem e destino precisam ser diferentes', path: ['destino_id'] });

/** "Gastei": despesa rápida com categoria e carteira obrigatórias. */
export const gastoRapidoSchema = z.object({
  valor: valorPositivo,
  categoria: z.string().trim().min(1).max(100).default('Outros'),
  descricao: z.string().trim().max(500).optional(),
  carteira_id: z.string().uuid('Escolha onde saiu o dinheiro'),
  data: dataISOSchema,
});

/** "Entrou dinheiro": entrada avulsa (categoria Entrada extra). */
export const entradaAvulsaSchema = z.object({
  valor: valorPositivo,
  descricao: z.string().trim().max(500).optional(),
  carteira_id: z.string().uuid('Escolha onde entrou o dinheiro'),
  data: dataISOSchema,
});

export const corrigirSaldoSchema = z.object({
  carteira_id: z.string().uuid(),
  saldo_real: z.number().multipleOf(0.01).min(-9999999999.99).max(9999999999.99),
});

export const receberRendaSchema = z.object({
  competencia: competenciaSchema,
  recebido_em: dataISOSchema.optional(),
  carteira_id: z.string().uuid().nullable().optional(),
});
