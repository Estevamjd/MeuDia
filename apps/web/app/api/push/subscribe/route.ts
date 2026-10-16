import { NextResponse } from 'next/server';
import { pushSubscriptionsRepository, pushSubscriptionSchema } from '@meudia/api';
import { z } from 'zod';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { apiError } from '../../../../lib/api-error';

export async function POST(request: Request) {
  try {
    const client = createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const sub = pushSubscriptionSchema.parse(await request.json());
    await pushSubscriptionsRepository.upsertByEndpoint(user.id, sub, client);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const client = createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { endpoint } = z.object({ endpoint: pushSubscriptionSchema.shape.endpoint }).parse(await request.json());
    await pushSubscriptionsRepository.removeByEndpoint(user.id, endpoint, client);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}

export async function GET(request: Request) {
  try {
    const client = createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const endpoint = pushSubscriptionSchema.shape.endpoint.parse(new URL(request.url).searchParams.get('endpoint'));
    const { data, error: queryError } = await client.from('push_subscriptions')
      .select('id').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle();
    if (queryError) throw queryError;
    return NextResponse.json({ inscrito: !!data, userId: user.id });
  } catch (error) { return apiError(error); }
}
