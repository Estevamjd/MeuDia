// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../components/ui';
import ConfiguracoesPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/configuracoes',
  useSearchParams: () => new URLSearchParams(),
}));

const estado = vi.hoisted(() => ({
  modo: 'financas' as 'financas' | 'padrao',
  rendas: [] as unknown[],
  signOut: vi.fn(),
  salvarNome: vi.fn(),
  salvarRenda: vi.fn(),
}));
vi.mock('../../../../components/AppModeProvider', () => ({ useAppMode: () => estado.modo }));
vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u', email: 'ana@exemplo.com' }, loading: false, signOut: estado.signOut }),
}));
const ok = <T,>(data: T) => ({ data, isLoading: false, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() });
vi.mock('../../../../hooks', () => ({
  useProfile: () => ok({ id: 'u', nome: 'Ana' }),
  useUpdateProfile: () => ({ mutate: estado.salvarNome, isPending: false }),
  useRendas: () => ok(estado.rendas),
  useAtualizarRenda: () => ({ mutate: estado.salvarRenda, isPending: false }),
  usePushLembretes: () => ({ estado: 'inativo', ocupado: false, ativar: vi.fn(), desativar: vi.fn() }),
}));

const renda = (id: string, descricao: string, created_at: string, dia: number | null) =>
  ({ id, user_id: 'u', descricao, valor: 900, dia_recebimento: dia, ativo: true, created_at, updated_at: null });

beforeEach(() => {
  estado.modo = 'financas';
  estado.rendas = [renda('freela', 'Freela', '2026-01-01T00:00:00Z', 20), renda('sal', 'Salário', '2026-03-01T00:00:00Z', 5)];
  vi.clearAllMocks();
});
afterEach(cleanup);

const pagina = () => render(<ToastProvider><ConfiguracoesPage /></ToastProvider>);

describe('Configurações (modo Finanças)', () => {
  it('h1 "Configurações" com acento e seções na ordem do BRIEF', () => {
    const { container } = pagina();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Configurações');
    const ordem = [...container.querySelectorAll('[data-secao]')].map((s) => s.getAttribute('data-secao'));
    expect(ordem).toEqual(['perfil', 'categorias', 'notificacoes', 'privacidade', 'sair', 'perigo']);
  });

  it('Perfil: nome e dia do salário da renda "Salário" (não da mais antiga); salvar usa os services existentes', () => {
    pagina();
    const perfil = screen.getByRole('region', { name: 'Perfil' });
    expect(within(perfil).getByRole('button', { name: /Nome.*Ana/ })).toBeTruthy();
    expect(within(perfil).getByRole('button', { name: /Dia do salário.*Dia 5/ })).toBeTruthy();

    fireEvent.click(within(perfil).getByRole('button', { name: /Nome/ }));
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: '  Ana Paula ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(estado.salvarNome).toHaveBeenCalledWith({ nome: 'Ana Paula' }, expect.anything());
    cleanup();

    pagina();
    fireEvent.click(screen.getByRole('button', { name: /Dia do salário/ }));
    fireEvent.change(screen.getByLabelText('Dia do recebimento'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(estado.salvarRenda).toHaveBeenCalledWith({ id: 'sal', data: { dia_recebimento: 10 } }, expect.anything());
  });

  it('dia do salário fora de 1–31 não salva; nome vazio não salva', () => {
    pagina();
    fireEvent.click(screen.getByRole('button', { name: /Dia do salário/ }));
    fireEvent.change(screen.getByLabelText('Dia do recebimento'), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(estado.salvarRenda).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/1 a 31/);
    cleanup();
    pagina();
    fireEvent.click(screen.getByRole('button', { name: /Nome/ }));
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(estado.salvarNome).not.toHaveBeenCalled();
  });

  it('sem renda: "Cadastre sua renda" leva ao Orçamento', () => {
    estado.rendas = [];
    pagina();
    const link = within(screen.getByRole('region', { name: 'Perfil' })).getByRole('link', { name: /Cadastre sua renda/ });
    expect(link.getAttribute('href')).toBe('/financas/orcamento');
  });

  it('Categorias e limites → Orçamento; Privacidade com Política, Termos e Baixar meus dados', () => {
    pagina();
    expect(within(screen.getByRole('region', { name: 'Categorias' })).getByRole('link', { name: /Categorias e limites/ }).getAttribute('href'))
      .toBe('/financas/orcamento');
    const priv = screen.getByRole('region', { name: 'Privacidade' });
    expect(within(priv).getByRole('link', { name: /Política de privacidade/ }).getAttribute('href')).toBe('/privacidade');
    expect(within(priv).getByRole('link', { name: /Termos de uso/ }).getAttribute('href')).toBe('/termos');
    const baixar = within(priv).getByRole('link', { name: /Baixar meus dados/ });
    expect(baixar.getAttribute('href')).toBe('/api/financas/exportar');
    expect(baixar.hasAttribute('download')).toBe(true);
  });

  it('Notificações com os lembretes; Sair chama signOut; "Excluir minha conta" igual a hoje', () => {
    pagina();
    expect(within(screen.getByRole('region', { name: 'Notificações' })).getByText('Lembretes de vencimento')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(estado.signOut).toHaveBeenCalled();
    const perigo = screen.getByText('Zona de perigo').closest('section')!;
    expect(perigo.textContent).toContain('A exclusao da conta remove permanentemente todos os seus dados');
    fireEvent.click(within(perigo).getByRole('button', { name: 'Excluir minha conta' }));
    expect(within(perigo).getByPlaceholderText('EXCLUIR')).toBeTruthy();
  });

  it('alvos de toque ≥ 44px nas linhas (min-h-11)', () => {
    pagina();
    for (const nome of [/Nome/, /Dia do salário/]) expect(screen.getByRole('button', { name: nome }).className).toMatch(/min-h-1[1-9]|min-h-\[/);
    expect(screen.getByRole('link', { name: /Baixar meus dados/ }).className).toMatch(/min-h-1[1-9]|min-h-\[/);
    expect(screen.getByRole('button', { name: 'Sair' }).className).toMatch(/min-h-1[1-9]|min-h-\[/);
  });
});

describe('Configurações (modo padrão) sem mudança', () => {
  it('Conta, Legal e Zona de perigo; sem Perfil/Baixar meus dados', () => {
    estado.modo = 'padrao';
    pagina();
    expect(screen.getByText('ana@exemplo.com')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('Zona de perigo')).toBeTruthy();
    expect(screen.queryByText('Baixar meus dados')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Perfil' })).toBeNull();
  });
});
