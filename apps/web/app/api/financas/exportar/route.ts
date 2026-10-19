import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { apiError } from '../../../../lib/api-error';
import { buscarDadosExportacao, gerarCsvExportacao, nomeArquivoExportacao, type LerPagina } from '../../../../lib/exportar-dados';

export const dynamic = 'force-dynamic';

/** "Baixar meus dados": CSV só com as linhas do usuário da sessão (cookies + RLS; nunca service_role). */
export async function GET() {
  try {
    const client = createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    // `user_id` filtrado explicitamente (além da RLS); página por chave: id > último lido, em ordem de id.
    const lerPagina: LerPagina = (tabela, colunas, userId, aposId, limite) => {
      const q = client.from(tabela).select(colunas).eq('user_id', userId);
      return (aposId === null ? q : q.gt('id', aposId)).order('id', { ascending: true }).limit(limite) as unknown as ReturnType<LerPagina>;
    };
    const csv = gerarCsvExportacao(await buscarDadosExportacao(lerPagina, user.id));
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeArquivoExportacao()}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) { return apiError(error); }
}
