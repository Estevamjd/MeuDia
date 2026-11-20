import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hojeSP } from '@meudia/shared';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { chamarClaude } from '../../../../lib/ia/provedor';
import { passouDoLimite } from '../../../../lib/ia/limite';
import { CATEGORIAS_IA, validarProposta, type RespostaIaChat } from '../../../../lib/ia/proposta';

export const dynamic = 'force-dynamic';

const corpoSchema = z.object({ mensagem: z.string().trim().min(1).max(500) });

/** Motivos fixos, sem conteúdo do usuário ou do provedor. */
const fallback = (gravada: boolean, motivo?: string) => {
  if (motivo) console.warn(`[ia/chat] fallback motivo=${motivo}`);
  return NextResponse.json({ fallback: true, gravada } satisfies RespostaIaChat, { headers: { 'Cache-Control': 'no-store' } });
};

/**
 * F1 meudia-ia: transforma "gastei 45 no mercado" no card de um gasto. Grava a mensagem no chat antes de consumir a cota atômica;
 * a transação só é gravada pelo Confirmar, pelo "Gastei" que já existe. Client do usuário (cookies + RLS), nunca service_role.
 * Sem chave, cota do dia estourada, erro ou resposta inválida do modelo: `{fallback:true}` e o cliente usa as regras.
 */
export async function POST(req: Request) {
  const client = createServerSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let gravada = false;
  try {
    const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ code: 'VALIDATION_ERROR', error: 'Dados inválidos' }, { status: 400 });

    const { error: erroMensagem } = await client.from('chat_agente').insert({
      user_id: user.id,
      role: 'user',
      conteudo: corpo.data.mensagem,
    });
    if (erroMensagem) return fallback(gravada, 'erro_gravar');

    gravada = true;

    const chave = process.env.ANTHROPIC_API_KEY?.trim();
    if (!chave) return fallback(gravada, 'sem_chave');

    if (await passouDoLimite(client, user.id)) return fallback(gravada, 'limite');

    const { data: carteiras, error: erroCarteiras } = await client
      .from('carteiras')
      .select('id, nome')
      .eq('user_id', user.id)
      .eq('arquivada', false);
    if (erroCarteiras) return fallback(gravada, 'erro_carteiras');
    const ativas = (carteiras ?? []) as { id: string; nome: string }[];

    const hojeISO = hojeSP();
    const respostaModelo = await chamarClaude({
      uso: 'chat_gasto',
      mensagem: corpo.data.mensagem,
      maxTokens: 256,
      temperatura: 0,
      system: `Você ajuda a anotar gastos em reais (pt-BR). Hoje é ${hojeISO} (America/Sao_Paulo). Preencha somente o card do gasto relatado; não grava nada. Marque e_gasto=false para receitas, transferências, dinheiro guardado, empréstimos, vendas ou qualquer mensagem que não relate uma despesa. Não invente valores: quando e_gasto=false, valor pode ser 0 ou omitido.`,
      ferramenta: {
        name: 'propor_gasto',
        description: 'Preenche o card de um gasto para confirmação posterior.',
        input_schema: {
          type: 'object',
          properties: {
            e_gasto: { type: 'boolean', description: 'True somente para uma despesa relatada.' },
            valor: { type: 'number', description: 'Valor positivo em reais.' },
            categoria: { type: 'string', enum: CATEGORIAS_IA },
            descricao: { type: 'string', description: 'Descrição curta.' },
            data: { type: 'string', description: `AAAA-MM-DD; sem data explícita use ${hojeISO}.` },
            carteira: { type: 'string', ...(ativas.length ? { enum: ativas.map((c) => c.nome) } : {}) },
          },
          required: ['e_gasto'],
        },
      },
    });
    if (!respostaModelo || respostaModelo.tipo !== 'ferramenta') return fallback(gravada, 'provedor_sem_proposta');
    const args = respostaModelo.input;
    const classificacao = z.object({ e_gasto: z.boolean() }).safeParse(args);
    if (!classificacao.success) return fallback(gravada, 'proposta_invalida');
    if (!classificacao.data.e_gasto) return fallback(gravada, 'nao_gasto');

    const proposta = validarProposta(args, { categorias: CATEGORIAS_IA, carteiras: ativas, hojeISO });
    if (!proposta) return fallback(gravada, 'proposta_invalida');

    // eslint-disable-next-line no-console -- observabilidade: só o marcador, sem dado do usuário.
    console.info('[ia/chat] ok');
    const resposta: RespostaIaChat = { fallback: false, gravada: true, proposta };
    return NextResponse.json(resposta, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Só o motivo: o erro pode carregar a requisição ao modelo.
    return fallback(gravada, 'excecao');
  }
}
