import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hojeSP } from '@meudia/shared';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { chamarProporGasto, chaveGemini } from '../../../../lib/ia/gemini';
import { passouDoLimite } from '../../../../lib/ia/limite';
import { CATEGORIAS_IA, validarProposta, type RespostaIaChat } from '../../../../lib/ia/proposta';

export const dynamic = 'force-dynamic';

const corpoSchema = z.object({ mensagem: z.string().trim().min(1).max(500) });

const fallback = (gravada: boolean) => NextResponse.json({ fallback: true, gravada } satisfies RespostaIaChat, { headers: { 'Cache-Control': 'no-store' } });

/**
 * F1 meudia-ia: transforma "gastei 45 no mercado" no card de um gasto. Grava a mensagem no chat para consumir cota;
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
    if (erroMensagem) return fallback(gravada);

    gravada = true;

    const chave = chaveGemini();
    if (!chave) return fallback(gravada);

    if (await passouDoLimite(client, user.id)) return fallback(gravada);

    const { data: carteiras, error: erroCarteiras } = await client
      .from('carteiras')
      .select('id, nome')
      .eq('user_id', user.id)
      .eq('arquivada', false);
    if (erroCarteiras) return fallback(gravada);
    const ativas = (carteiras ?? []) as { id: string; nome: string }[];

    const hojeISO = hojeSP();
    const args = await chamarProporGasto(
      { mensagem: corpo.data.mensagem, categorias: CATEGORIAS_IA, carteiras: ativas.map((c) => c.nome), hojeISO },
      chave,
    );
    if (args === null) return fallback(gravada);

    const proposta = validarProposta(args, { categorias: CATEGORIAS_IA, carteiras: ativas, hojeISO });
    if (!proposta) return fallback(gravada);

    const resposta: RespostaIaChat = { fallback: false, gravada: true, proposta };
    return NextResponse.json(resposta, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Nada de log com detalhes: o erro pode carregar a requisição ao modelo.
    return fallback(gravada);
  }
}
