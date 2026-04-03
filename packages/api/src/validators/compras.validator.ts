import { z } from 'zod';

export const listaInsertSchema = z.object({
  nome: z.string().min(1, 'Nome da lista é obrigatório').max(100).default('Lista de Compras'),
});

export const itemInsertSchema = z.object({
  lista_id: z.string().uuid('ID da lista inválido'),
  nome: z.string().min(1, 'Nome do item é obrigatório').max(200),
  quantidade: z.number().min(0.01, 'Quantidade deve ser maior que zero').default(1),
  unidade: z.string().max(20).default('un'),
  categoria: z.string().max(100).nullable().optional(),
  preco_estimado: z.number().min(0).nullable().optional(),
});
