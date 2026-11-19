import { NextResponse, type NextRequest } from 'next/server';
import { assinaturaValida, processarEvento } from '../../../../lib/whatsapp/processar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_CORPO = 64 * 1024;

/**
 * Webhook do WAHA (docs/whatsapp.md). Sem `WHATSAPP_WEBHOOK_HMAC_KEY` fica desligado (503).
 * Corpo sem assinatura HMAC-SHA512 válida → 401. Erros internos devolvem 200 para o WAHA não
 * reenviar em loop (a mensagem duplicada também é barrada no banco).
 */
export async function POST(req: NextRequest) {
  const chave = process.env.WHATSAPP_WEBHOOK_HMAC_KEY;
  if (!chave) return NextResponse.json({ erro: 'desligado' }, { status: 503 });
  const corpo = await req.text();
  if (corpo.length > LIMITE_CORPO) return NextResponse.json({ erro: 'grande_demais' }, { status: 413 });
  if (!assinaturaValida(corpo, req.headers.get('x-webhook-hmac'), chave)) {
    return NextResponse.json({ erro: 'assinatura' }, { status: 401 });
  }
  let evento: unknown;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: 'json' }, { status: 400 });
  }
  try {
    const r = await processarEvento(evento);
    return NextResponse.json({ ok: true, status: r.status });
  } catch {
    console.warn('[whatsapp] erro ao processar');
    return NextResponse.json({ ok: false });
  }
}
