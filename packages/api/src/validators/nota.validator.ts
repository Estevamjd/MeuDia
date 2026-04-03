import { z } from 'zod';

export const notaInsertSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório').max(200),
  conteudo: z.string().max(50000).default(''),
  tags: z.array(z.string().max(50)).max(20).default([]),
  cor: z.string().max(30).default('default'),
  fixada: z.boolean().default(false),
  checklist: z.array(z.object({
    id: z.string(),
    text: z.string().max(500),
    checked: z.boolean(),
  })).max(100).default([]),
  lembrete: z.string().max(30).nullable().default(null),
});

export const notaUpdateSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  conteudo: z.string().max(50000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  cor: z.string().max(30).optional(),
  fixada: z.boolean().optional(),
  checklist: z.array(z.object({
    id: z.string(),
    text: z.string().max(500),
    checked: z.boolean(),
  })).max(100).optional(),
  lembrete: z.string().max(30).nullable().optional(),
});
