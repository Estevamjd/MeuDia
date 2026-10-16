// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NotificacaoAgente } from '@meudia/shared';
import { AppModeProvider } from '../../AppModeProvider';
import { AgentPanel } from '../AgentPanel';

const push = vi.fn();
const marcarLida = vi.fn();
const marcarTodasLidas = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const notif = (id: string, modulo: NotificacaoAgente['modulo'], rota: string): NotificacaoAgente => ({
  id,
  user_id: 'u1',
  tipo: 'info',
  titulo: `Aviso ${modulo}`,
  mensagem: '...',
  modulo,
  lida: false,
  dispensada: false,
  acoes: [{ label: `Abrir ${rota}`, acao: 'NAVEGAR', payload: { rota } }],
  created_at: new Date().toISOString(),
});

const NOTIFICACOES = [notif('n1', 'financas', '/financas/contas'), notif('n2', 'treino', '/treinos')];
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('../../../hooks/useAgente', () => ({
  useNotificacoes: () => ({ data: NOTIFICACOES, isLoading: false }),
  useMensagensChat: () => ({ data: [], isLoading: false }),
  useEnviarMensagem: () => mutation,
  useMarcarNotificacaoLida: () => ({ ...mutation, mutate: marcarLida }),
  useMarcarTodasLidas: () => ({ ...mutation, mutate: marcarTodasLidas }),
  useDispensarNotificacao: () => mutation,
  useContarNaoLidas: () => ({ data: 2 }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' } }) }));
vi.mock('../../../hooks/useAgenda', () => ({ useCriarCompromisso: () => mutation }));
vi.mock('../../../hooks', () => ({
  useProfile: () => ({ data: { nome: 'Ana', objetivo: null } }),
  useTreinos: () => ({
    data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: `t${d}`, nome: 'Treino A', dia_semana: d, exercicios: [] })),
  }),
  useSessoesSemana: () => ({ data: [] }),
  useHabitos: () => ({
    data: [{ id: 'h1', nome: 'Ler', ativo: true, frequencia: 'diario', dias_semana: [] }],
  }),
  useRegistrosHoje: () => ({ data: [] }),
  useResumoMensal: () => ({ data: { saldo: 0, totalDespesas: 0, totalReceitas: 0 } }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPanel = (mode: 'financas' | 'padrao') =>
  render(
    <AppModeProvider mode={mode} vapidPublicKey={null}>
      <AgentPanel isOpen onClose={vi.fn()} />
    </AppModeProvider>,
  );

const textoBotoes = () => screen.getAllByRole('button').map((b) => b.textContent ?? '');

describe('AgentPanel acessível', () => {
  it.each(['financas', 'padrao'] as const)('é um dialog modal rotulado (%s)', (mode) => {
    renderPanel(mode);
    const dialog = screen.getByRole('dialog', { name: 'Agente MeuDia' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const id = dialog.getAttribute('aria-labelledby');
    expect(id && document.getElementById(id)?.textContent).toBe('Agente MeuDia');
  });
});

describe('AgentPanel por APP_MODE', () => {
  it('financas: abre direto no Chat, sem aba Resumo, com sugestões só de finanças', () => {
    renderPanel('financas');
    expect(screen.queryByRole('button', { name: 'Resumo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Chat' }).className).toContain('text-accent');
    expect(screen.getByText(/gastos, contas, orçamento/)).toBeTruthy();
    const botoes = textoBotoes();
    expect(botoes).toEqual(expect.arrayContaining(['Resumo financeiro', 'Ver contas', 'Ver orçamento']));
    expect(botoes.some((t) => /treino|hábito|compromisso/i.test(t))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Ver contas' }));
    expect(push).toHaveBeenCalledWith('/financas/contas');
  });

  it('financas: alertas só do módulo finanças, badge e "marcar todas" restritos a elas', () => {
    renderPanel('financas');
    const alertas = screen.getByRole('button', { name: /Alertas/ });
    expect(alertas.textContent).toBe('Alertas1');
    fireEvent.click(alertas);
    expect(screen.getByText('Aviso financas')).toBeTruthy();
    expect(screen.queryByText('Aviso treino')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir /treinos' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Marcar todas como lidas/ }));
    expect(marcarTodasLidas).not.toHaveBeenCalled();
    expect(marcarLida.mock.calls).toEqual([['n1']]);
  });

  it('padrão: inalterado (abre no Resumo com treinos/hábitos e todas as notificações)', () => {
    renderPanel('padrao');
    expect(screen.getByRole('button', { name: 'Resumo' }).className).toContain('text-accent');
    expect(screen.getByText(/Treino A/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText(/treinos, hábitos, agenda ou finanças/)).toBeTruthy();
    expect(textoBotoes()).toEqual(expect.arrayContaining(['Treino: Treino A', '1 hábitos pendentes']));

    const alertas = screen.getByRole('button', { name: /Alertas/ });
    expect(alertas.textContent).toBe('Alertas2');
    fireEvent.click(alertas);
    expect(screen.getByText('Aviso treino')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas como lidas/ }));
    expect(marcarTodasLidas).toHaveBeenCalledOnce();
  });
});
