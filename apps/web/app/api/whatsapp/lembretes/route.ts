import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { rodarLembretes } from '../../../../lib/whatsapp/lembretes-rodada';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Agendador dos lembretes do WhatsApp (docs/whatsapp.md §7.1). Chamado pelo n8n a cada 15 min com
 * `Authorization: Bearer <WHATSAPP_LEMBRETES_SEGREDO>`. `?dry=1` só simula (não reserva nem envia; aceita
 * `agora=<ISO>` e `ia=1`). Sem segredo configurado, a rota fica desligada.
 */
function autorizado(req: NextRequest, segredo: string): boolean {
  const recebido = Buffer.from(req.headers.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function POST(req: NextRequest) {
  const segredo = process.env.WHATSAPP_LEMBRETES_SEGREDO;
  if (!segredo || segredo.length < 32) return NextResponse.json({ erro: 'desligado' }, { status: 503 });
  if (!autorizado(req, segredo)) return NextResponse.json({ erro: 'nao_autorizado' }, { status: 401 });

  const url = req.nextUrl;
  const dry = url.searchParams.get('dry') === '1';
  const agoraParam = url.searchParams.get('agora');
  const agora = dry && agoraParam ? new Date(agoraParam) : undefined;
  if (agora && Number.isNaN(agora.getTime())) return NextResponse.json({ erro: 'agora_invalido' }, { status: 400 });

  try {
    const r = await rodarLembretes({ dry, agora, usarIA: dry && url.searchParams.get('ia') === '1' });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch {
    console.warn('[whatsapp/lembrete] rodada falhou');
    return NextResponse.json({ ok: false, erro: 'interno' }, { status: 500 });
  }
}
