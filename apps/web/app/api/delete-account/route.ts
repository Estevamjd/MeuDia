import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuracao do servidor incompleta' },
        { status: 500 },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Uma única transação em auth.users apaga as cascatas (ver INVENTARIO.md).
    // Não pré-apagar vínculos: proteger_vinculo bloqueia DELETE direto.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[delete-account] falha na exclusao atomica');
      return NextResponse.json(
        { error: 'Erro ao excluir conta' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('[delete-account] falha inesperada');
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
