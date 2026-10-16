import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { lembretesService } from '@meudia/api';
import { createPushSender } from '../../../../lib/web-push';
import { apiError } from '../../../../lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('Authorization');
  if (!secret || !authorization || !timingSafeEqual(
    createHash('sha256').update(authorization).digest(),
    createHash('sha256').update(`Bearer ${secret}`).digest(),
  )) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Configuração do servidor incompleta');
    const sender = createPushSender(); // Falha antes de ler contas ou reservar lembretes se não configurado.
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return NextResponse.json(await lembretesService.enviarLembretesDoDia({ client, sender }));
  } catch (error) { return apiError(error); }
}
