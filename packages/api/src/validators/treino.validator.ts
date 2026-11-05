import { z } from 'zod';
import { lerFaixaRepeticoes } from '@meudia/shared';

export const treinoInsertSchema = z.object({
  nome: z.string().min(1, 'Nome do treino é obrigatório').max(100),
  dia_semana: z.number().min(0).max(6).transform(n => n as 0|1|2|3|4|5|6),
  tipo: z.enum(['musculacao', 'cardio', 'funcional', 'descanso']).nullable().optional(),
  observacao: z.string().max(2000).nullable().optional(),
  ordem: z.number().optional(),
});

export const exercicioInsertSchema = z.object({
  treino_id: z.string().uuid(),
  nome: z.string().min(1, 'Nome do exercício é obrigatório').max(100),
  series: z.number().min(1).default(3),
  // "8-12", "10" ou "" (série sem repetição, ex.: prancha). Vira repeticoes_min/max no repositório.
  repeticoes: z.string().max(20).refine((t) => lerFaixaRepeticoes(t) !== null, 'Use um número (10) ou uma faixa (8-12)').default('10-12'),
  carga: z.number().min(0).nullable().optional(),
  tempo_descanso: z.number().min(0).default(60),
  observacao: z.string().max(500).nullable().optional(),
  ordem: z.number().optional(),
});

export const serieRealizadaSchema = z.object({
  sessao_id: z.string().uuid(),
  exercicio_id: z.string().uuid(),
  numero_serie: z.number().min(1),
  carga_usada: z.number().min(0).nullable().optional(),
  reps_feitas: z.number().min(0).nullable().optional(),
  concluido: z.boolean().default(false),
});

export const sessaoInsertSchema = z.object({
  treino_id: z.string().uuid().nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido').optional(),
  duracao_minutos: z.number().min(0).nullable().optional(),
  concluido: z.boolean().default(false),
  observacao: z.string().max(2000).nullable().optional(),
});
