import { NextResponse } from 'next/server';
import { contasPagarService } from '@meudia/api';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';
import { apiError } from '../../../../../../lib/api-error';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json(await contasPagarService.pagarConta(user.id, params.id, await request.json(), client));
  } catch (error) { return apiError(error); }
}
