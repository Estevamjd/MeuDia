import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../assinatura.repository';
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: {}, error: null }).then(resolve),
};
beforeEach(() => { vi.clearAllMocks(); getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) }); });
it.each([() => repo.findById('a', 'u'), () => repo.update('a', { valor: 20 }, 'u'), () => repo.remove('a', 'u')])('sempre restringe id e user_id', async operation => {
  await operation(); expect(query.eq).toHaveBeenCalledWith('id', 'a'); expect(query.eq).toHaveBeenCalledWith('user_id', 'u');
});
