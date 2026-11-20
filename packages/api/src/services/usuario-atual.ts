import { AppError } from '@meudia/shared';
import { getSupabase } from '../repositories/supabase';

// Apenas para o client no browser: lê a sessão local, sem validar identidade na rede.
// A autorização real continua sendo garantida pela RLS no banco.
export async function usuarioAtualId(): Promise<string> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!session) throw new AppError('Não autenticado', 'UNAUTHORIZED', 401);
  return session.user.id;
}
