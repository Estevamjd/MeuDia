// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { historicoHabitos } from '../../../lib/habitos-semana';

/**
 * Review Codex 5: "hoje" civil nas telas = dia de São Paulo, também no aparelho em UTC ou Tóquio. 22:30 de quinta
 * 19/11/2026 em BRT = 01:30 UTC de sexta 20/11 (10:30 de sexta em Tóquio): botão Hoje da agenda, histórico de 7 dias
 * dos hábitos e os cabeçalhos de data de Saúde e Início mostram quinta 19.
 */
const AGORA = new Date('2026-11-20T01:30:00Z');
const TZ_ORIGINAL = process.env.TZ;

const { porData, consulta, mutacao } = vi.hoisted(() => ({
  porData: vi.fn(),
  consulta: (data: unknown = undefined) => ({ data, isLoading: false, isError: false, refetch: () => undefined }),
  mutacao: () => ({ mutateAsync: async () => undefined, mutate: () => undefined, isPending: false }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));
vi.mock('../../../components/agent', () => ({ AgentBannerAuto: () => null, AgentBanner: () => null }));
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
  useCompromissosPorData: (d: string) => (porData(d), consulta([])),
  useCriarCompromisso: mutacao,
  useAtualizarCompromisso: mutacao,
  useExcluirCompromisso: mutacao,
  useMarcarConcluido: mutacao,
  usePerfilSaude: () => ({ perfil: { estado: 'adiado', respostas: null, metas: null }, carregado: true, salvarCadastro: vi.fn(), adiar: vi.fn() }),
  usePesoRecente: () => consulta([]),
  useProfile: () => consulta({ nome: 'Ana' }),
  useRegistrarPesoDoDia: mutacao,
  useSessoesSemana: () => consulta([]),
  useTreinos: () => consulta([]),
  useUpdateProfile: mutacao,
  useHabitos: () => consulta([]),
  useRegistrosHoje: () => consulta([]),
  useResumoMensal: () => consulta(undefined),
  useAssinaturas: () => consulta([]),
  useTotalMensal: () => consulta(0),
  useTransacoesMes: () => consulta([]),
}));

import AgendaPage from '../agenda/page';
import SaudeHojePage from '../saude/page';
import InicioPage from '../inicio/page';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  porData.mockReset();
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

  it('agenda: abre em quinta 19 e o botão Hoje volta para quinta 19 (não sexta)', () => {
    render(<AgendaPage />);
    expect(screen.getByText('quinta-feira, 19 de novembro')).toBeTruthy();
    expect(porData).toHaveBeenLastCalledWith('2026-11-19');
    fireEvent.click(screen.getByLabelText('Proximo dia'));
    fireEvent.click(screen.getByLabelText('Proximo dia'));
    expect(screen.getByText('sábado, 21 de novembro')).toBeTruthy();
    fireEvent.click(screen.getByText('sábado, 21 de novembro'));
    expect(screen.getByText('quinta-feira, 19 de novembro')).toBeTruthy();
    expect(porData).toHaveBeenLastCalledWith('2026-11-19');
  });

  it('hábitos: os últimos 7 dias terminam em quinta 19 (o mesmo hojeSP das consultas) e o registro de hoje conta', () => {
    const dias = historicoHabitos(
      [{ frequencia: 'diario', dias_semana: [] }],
      [{ data: '2026-11-19', concluido: true }, { data: '2026-11-20', concluido: true }],
    );
    expect(dias.map((d) => d.iso)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
    expect(dias.at(-1)).toMatchObject({ diaSemana: 4, diaDoMes: '19', status: 'done' });
    expect(dias.at(-2)?.status).toBe('missed');
    // Hábito só às sextas: hoje (quinta) é descanso.
    expect(historicoHabitos([{ frequencia: 'semanal', dias_semana: [5] }], []).at(-1)?.status).toBe('rest');
  });

  it('saúde: cabeçalho com QUINTA 19 NOV', () => {
    render(<SaudeHojePage />);
    expect(screen.getByText('QUINTA 19 NOV')).toBeTruthy();
  });

  it('início: data do cabeçalho em quinta 19', () => {
    render(<InicioPage />);
    expect(screen.getByText(/quinta, 19 nov 2026/)).toBeTruthy();
  });
});
