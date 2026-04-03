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

    // Delete user data from all tables (order matters for foreign keys)
    const userIdTables = [
      'series_realizadas',
      'sessoes_treino',
      'exercicios',
      'treinos',
      'registro_habitos',
      'habitos',
      'compromissos',
      'transacoes',
      'assinaturas',
      'notas',
      'itens_compras',
      'listas_compras',
      'registro_medicamentos',
      'medicamentos',
      'refeicoes',
      'registro_agua',
      'registros_peso',
      'manutencoes',
      'veiculos',
      'scores_diarios',
      'conquistas',
      'chat_agente',
      'acoes_agente',
      'notificacoes_agente',
      'preferencias_agente',
    ];

    for (const table of userIdTables) {
      await adminClient.from(table).delete().eq('user_id', user.id);
    }

    // profiles uses 'id' not 'user_id'
    await adminClient.from('profiles').delete().eq('id', user.id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Erro ao deletar usuario:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir conta' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro inesperado ao deletar conta:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
