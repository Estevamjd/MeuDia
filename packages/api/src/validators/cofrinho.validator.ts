import { z } from 'zod';
import { competenciaSchema } from './contas-pagar.validator';

const doisDecimais = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
const valorPositivo = z.number().positive('Informe um valor maior que zero').max(99999999.99).refine(doisDecimais, 'Use no máximo 2 casas decimais');

export const moverCofrinhoSchema = z.object({ tipo: z.enum(['guardar', 'tirar']), valor: valorPositivo });
export const corrigirCofrinhoSchema = z.object({
  valor_real: z.number().min(0, 'O Cofrinho não fica negativo').max(99999999.99).refine(doisDecimais, 'Use no máximo 2 casas decimais'),
});
export const fecharMesSchema = z.discriminatedUnion('guardar', [
  z.object({ competencia: competenciaSchema, guardar: z.literal(true), valor: valorPositivo }),
  z.object({ competencia: competenciaSchema, guardar: z.literal(false) }),
]);
