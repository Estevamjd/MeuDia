// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

/**
 * Troca de abas lenta no iPhone: cada componente com `useAuth` chamava `auth.getUser()` (rede) ao montar, e o
 * supabase-js serializa essas chamadas. A home tem ~20 usos: 20 idas ao Supabase em fila antes de qualquer dado.
 */
const getUser = vi.fn();
let aoMudar: ((evento: string, sessao: { user: { id: string } } | null) => void) | null = null;
const cliente = {
  auth: {
    getUser,
    onAuthStateChange: vi.fn((cb: typeof aoMudar) => {
      aoMudar = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: vi.fn(),
  },
};
vi.mock('../../lib/supabase/client', () => ({ createClient: () => cliente }));
vi.mock('@meudia/api', () => ({ setSupabaseClient: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

let resolver: (u: { id: string } | null) => void = () => {};
beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  getUser.mockImplementation(() => new Promise((r) => { resolver = (u) => r({ data: { user: u } }); }));
  aoMudar = null;
});
afterEach(cleanup);

async function montar(qtd: number) {
  const { useAuth } = await import('../useAuth');
  function Quem({ i }: { i: number }) {
    const { user, loading } = useAuth();
    return <p data-testid={`q${i}`}>{loading ? 'carregando' : user?.id ?? 'ninguém'}</p>;
  }
  return { Quem, ...render(<>{Array.from({ length: qtd }, (_, i) => <Quem key={i} i={i} />)}</>) };
}

describe('useAuth', () => {
  it('20 componentes montados juntos fazem uma só chamada a getUser', async () => {
    await montar(20);
    expect(getUser).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ id: 'u1' }));
    expect(screen.getByTestId('q19').textContent).toBe('u1');
  });

  it('componente montado depois (troca de aba) já nasce com o usuário, sem nova chamada nem "carregando"', async () => {
    const { Quem, rerender } = await montar(1);
    await act(async () => resolver({ id: 'u1' }));
    rerender(<><Quem i={0} /><Quem i={1} /></>);
    expect(screen.getByTestId('q1').textContent).toBe('u1');
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('login/logout (onAuthStateChange) chega a todos os componentes', async () => {
    await montar(3);
    await act(async () => resolver(null));
    expect(screen.getByTestId('q2').textContent).toBe('ninguém');
    await act(async () => aoMudar?.('SIGNED_IN', { user: { id: 'u2' } }));
    expect(screen.getByTestId('q0').textContent).toBe('u2');
    expect(screen.getByTestId('q2').textContent).toBe('u2');
    await act(async () => aoMudar?.('SIGNED_OUT', null));
    expect(screen.getByTestId('q1').textContent).toBe('ninguém');
  });

  it('getUser atrasado não ressuscita o usuário depois de logout ou troca de conta', async () => {
    await montar(2);
    await act(async () => aoMudar?.('SIGNED_OUT', null));
    await act(async () => resolver({ id: 'antigo' }));
    expect(screen.getByTestId('q0').textContent).toBe('ninguém');
    await act(async () => aoMudar?.('SIGNED_IN', { user: { id: 'u2' } }));
    expect(screen.getByTestId('q1').textContent).toBe('u2');
  });

  it('INITIAL_SESSION antes do getUser não descarta a resposta verificada do servidor', async () => {
    await montar(1);
    await act(async () => aoMudar?.('INITIAL_SESSION', { user: { id: 'local' } }));
    await act(async () => resolver(null));
    expect(screen.getByTestId('q0').textContent).toBe('ninguém');
  });

  it('erro no getUser: sem usuário e sem travar em "carregando"', async () => {
    getUser.mockRejectedValueOnce(new Error('rede'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar(2);
    await act(async () => {});
    expect(screen.getByTestId('q1').textContent).toBe('ninguém');
  });
});
