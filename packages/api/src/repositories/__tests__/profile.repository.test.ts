import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../profile.repository';
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));
let result: { data: unknown; error: unknown };
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
beforeEach(() => { vi.clearAllMocks(); result = { data: null, error: null }; getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) }); });
it('retorna null quando o perfil não existe (sem lançar erro)', async () => {
  await expect(repo.findById('u')).resolves.toBeNull(); expect(query.eq).toHaveBeenCalledWith('id', 'u'); expect(query.maybeSingle).toHaveBeenCalled();
});
it('retorna o perfil existente', async () => {
  result = { data: { id: 'u', onboarding_feito: true }, error: null };
  await expect(repo.findById('u')).resolves.toEqual({ id: 'u', onboarding_feito: true });
});
it('propaga erro do banco como DB_ERROR', async () => {
  result = { data: null, error: { message: 'boom' } };
  await expect(repo.findById('u')).rejects.toMatchObject({ code: 'DB_ERROR' });
});
