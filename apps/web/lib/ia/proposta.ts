import { z } from 'zod';
import { CATEGORIAS_GASTO } from '@meudia/shared';

/** Card que o assistente mostra antes de gravar. A rota de IA só devolve isto; quem grava é o "Confirmar". */
export interface PropostaGasto {
  valor: number;
  categoria: string;
  descricao: string;
  /** AAAA-MM-DD (hoje em BRT quando o modelo não diz). */
  data: string;
  /** Carteira ativa do usuário, ou null (o card cai na carteira padrão). */
  carteira_id: string | null;
}

/** Resposta de `POST /api/ia/chat`: ou um card validado, ou `fallback` (o cliente usa `processarMensagem`). */
export type RespostaIaChat = { fallback: true } | { fallback: false; proposta: PropostaGasto };

export interface CarteiraIa {
  id: string;
  nome: string;
}

/** Só as categorias de gasto do mapa único (as mesmas do "Gastei"). */
export const CATEGORIAS_IA: readonly string[] = CATEGORIAS_GASTO.map((c) => c.nome);

/** DECIMAL(10,2) de `transacoes.valor`. */
const VALOR_MAXIMO = 99999999.99;

function dataISOValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Argumentos de `propor_gasto` como o modelo manda (tudo desconfiado). */
const argsSchema = z.object({
  valor: z.coerce.number().finite().positive().max(VALOR_MAXIMO),
  categoria: z.string().trim().min(1).max(100),
  descricao: z.string().trim().max(500).optional().nullable(),
  data: z.string().trim().optional().nullable(),
  carteira: z.string().trim().max(100).optional().nullable(),
});

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Valida a chamada `propor_gasto` do modelo. Devolve null (fallback) se o valor não for > 0 e finito,
 * a categoria não estiver na lista, a data for inválida ou futura. Carteira fora das do usuário vira null.
 */
export function validarProposta(
  args: unknown,
  ctx: { categorias: readonly string[]; carteiras: readonly CarteiraIa[]; hojeISO: string },
): PropostaGasto | null {
  const r = argsSchema.safeParse(args);
  if (!r.success) return null;
  const a = r.data;

  const categoria = ctx.categorias.find((c) => semAcento(c) === semAcento(a.categoria));
  if (!categoria) return null;

  const data = a.data ? a.data : ctx.hojeISO;
  if (!dataISOValida(data) || data > ctx.hojeISO) return null;

  const valor = Math.round(a.valor * 100) / 100;
  if (!(valor > 0)) return null;

  const carteira = a.carteira ? ctx.carteiras.find((c) => semAcento(c.nome) === semAcento(a.carteira!)) : undefined;

  return {
    valor,
    categoria,
    descricao: a.descricao || categoria,
    data,
    carteira_id: carteira?.id ?? null,
  };
}
