// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * Review Codex 5: "hoje" civil nas telas = dia de São Paulo, também no aparelho em UTC ou Tóquio. 22:30 de quinta
 * 19/11/2026 em BRT = 01:30 UTC de sexta 20/11 (10:30 de sexta em Tóquio): o cabeçalho de data de Saúde mostra quinta 19.
 * (Agenda, hábitos e a Início antiga saíram com os módulos legados.)
 */
const AGORA = new Date('2026-11-20T01:30:00Z');
const TZ_ORIGINAL = process.env.TZ;

const { consulta, mutacao } = vi.hoisted(() => ({
  consulta: (data: unknown = undefined) => ({ data, isLoading: false, isError: false, refetch: () => undefined }),
  mutacao: () => ({ mutateAsync: async () => undefined, mutate: () => undefined, isPending: false }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, loading: false }) }));
vi.mock('../../../components/ui/Toast', async (orig) => ({
  ...(await orig<object>()),
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../../components/ui', async (orig) => ({
  ...(await orig<object>()),
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../../components/saude/useRefeicoesCaderno', () => ({
  useRefeicoesCaderno: () => ({ query: consulta([]), entradas: [], acoes: null, render: null, abrirNova: vi.fn(), elementos: null }),
}));
vi.mock('../../../hooks', () => ({
  hojeLocal: () => '2026-11-19',
  usePerfilSaude: () => ({ perfil: { estado: 'adiado', respostas: null, metas: null }, carregado: true, salvarCadastro: vi.fn(), adiar: vi.fn() }),
  usePesoRecente: () => consulta([]),
  useProfile: () => consulta({ nome: 'Ana' }),
  useRegistrarPesoDoDia: mutacao,
  useSessoesSemana: () => consulta([]),
  useTreinos: () => consulta([]),
  useUpdateProfile: mutacao,
}));

import SaudeHojePage from '../saude/page';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  process.env.TZ = TZ_ORIGINAL;
});

describe.each(['UTC', 'Asia/Tokyo', 'America/Sao_Paulo'])('aparelho em %s às 22:30 de quinta em SP', (tz) => {
  beforeEach(() => {
    process.env.TZ = tz;
  });

  it('saúde: cabeçalho com QUINTA 19 NOV', () => {
    render(<SaudeHojePage />);
    expect(screen.getByText('QUINTA 19 NOV')).toBeTruthy();
  });
});
