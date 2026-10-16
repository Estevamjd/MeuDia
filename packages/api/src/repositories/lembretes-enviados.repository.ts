import type { LembreteEnviado } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type Reserva = Pick<LembreteEnviado, 'user_id' | 'conta_id' | 'competencia' | 'etapa'> & { canal?: LembreteEnviado['canal'] };

export async function reservarLembreteParaCron(client: SupabaseClient, row: Reserva): Promise<boolean> {
  const { data, error } = await client.from('lembretes_enviados')
    .upsert({ ...row, canal: row.canal ?? 'push' }, {
      onConflict: 'conta_id,competencia,etapa,canal', ignoreDuplicates: true,
    }).select('id');
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data?.length ?? 0) > 0;
}
