// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NotificacaoAgente } from '@meudia/shared';
import { AppModeProvider } from '../../AppModeProvider';
import { AgentPanel, LIMIAR_ARRASTE_FECHAR } from '../AgentPanel';

const push = vi.fn();
const gasteiMutate = vi.fn();
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
const refetchChat = vi.fn().mockResolvedValue({});
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('../../../hooks/useAgente', () => ({
  useNotificacoes: () => ({ data: NOTIFICACOES, isLoading: false }),
  useMensagensChat: () => ({ data: [], isLoading: false, refetch: refetchChat }),
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
  // Card do gasto (IA): grava só pelo "Gastei".
  useCarteiras: () => ({ data: [{ id: 'c1', nome: 'Banco Teste', tipo: 'banco', arquivada: false }], isLoading: false }),
  usePainelSaldo: () => ({ data: { carteiraPadraoId: 'c1' } }),
  useGastei: () => ({ mutate: gasteiMutate, isPending: false }),
}));

// Relógio fixo (sábado 17/10/2026 10:00): depois das 20h o resumo repete o treino pendente e o teste dependia da hora.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 17, 10, 0));
});
afterAll(() => {
  vi.useRealTimers();
});
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

describe('AgentPanel: fechar e camadas (bug do X inalcançável no iPhone)', () => {
  // jsdom não tem PointerEvent: sem isto o fireEvent perde clientY/pointerType.
  beforeAll(() => {
    if (typeof window.PointerEvent === 'function') return;
    class PointerEventFake extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    window.PointerEvent = PointerEventFake as unknown as typeof PointerEvent;
  });

  const abrir = () => {
    const onClose = vi.fn();
    const utils = render(
      <AppModeProvider mode="financas" vapidPublicKey={null}>
        <AgentPanel isOpen onClose={onClose} />
      </AppModeProvider>,
    );
    return { onClose, ...utils };
  };

  it('renderiza em portal no body, na camada z-agente, como bottom sheet que não cobre o topo', () => {
    const { container } = abrir();
    const dialog = screen.getByRole('dialog', { name: 'Agente MeuDia' });
    expect(container.contains(dialog)).toBe(false);
    const raiz = dialog.parentElement!;
    expect(raiz.parentElement).toBe(document.body);
    expect(raiz.className).toContain('z-agente');
    expect(dialog.className).toContain('agente-sheet');
    expect(dialog.className).not.toMatch(/\bh-screen\b/);
  });

  it('X: rótulo "Fechar assistente", 44x44 e fecha', () => {
    const { onClose } = abrir();
    const x = screen.getByRole('button', { name: 'Fechar assistente' });
    expect(x.className).toMatch(/\bh-11\b/);
    expect(x.className).toMatch(/\bw-11\b/);
    fireEvent.click(x);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Esc fecha', () => {
    const { onClose } = abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('toque no backdrop fecha; toque dentro do painel não', () => {
    const { onClose } = abrir();
    fireEvent.click(screen.getByRole('dialog', { name: 'Agente MeuDia' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('agente-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('arrastar a alça para baixo além do limiar fecha; arraste curto não', () => {
    const { onClose } = abrir();
    const alca = screen.getByTestId('agente-alca');
    const arrastar = (dy: number) => {
      fireEvent.pointerDown(alca, { pointerType: 'touch', pointerId: 1, clientY: 100 });
      fireEvent.pointerMove(alca, { pointerType: 'touch', pointerId: 1, clientY: 100 + dy });
      fireEvent.pointerUp(alca, { pointerType: 'touch', pointerId: 1, clientY: 100 + dy });
    };
    arrastar(LIMIAR_ARRASTE_FECHAR - 20);
    expect(onClose).not.toHaveBeenCalled();
    arrastar(LIMIAR_ARRASTE_FECHAR + 20);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('trava o scroll do body enquanto aberto e devolve o foco ao gatilho ao fechar', () => {
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);
    gatilho.focus();
    const { rerender } = abrir();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');

    rerender(
      <AppModeProvider mode="financas" vapidPublicKey={null}>
        <AgentPanel isOpen={false} onClose={vi.fn()} />
      </AppModeProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });
});

describe('AgentPanel: gasto por linguagem natural (IA F1, LLM mockado)', () => {
  const fetchMock = vi.fn();
  beforeAll(() => vi.stubGlobal('fetch', fetchMock));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    fetchMock.mockReset();
    mutation.mutateAsync.mockResolvedValue(undefined);
  });

  const hoje = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const respostaIa = (corpo: unknown) => Promise.resolve(new Response(JSON.stringify(corpo), { status: 200 }));

  const enviar = (texto: string) => {
    renderPanel('financas');
    const input = screen.getByPlaceholderText('Pergunte algo ao agente...');
    fireEvent.change(input, { target: { value: texto } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  const agentes = () => mutation.mutateAsync.mock.calls.map((c) => c[0]).filter((m) => m.role === 'agent');

  it('"gastei 45 no mercado" → card R$ 45,00 / Mercado / Hoje; nada gravado antes do Confirmar; Cancelar não grava', async () => {
    fetchMock.mockImplementation(() =>
      respostaIa({ fallback: false, gravada: true, proposta: { valor: 45, categoria: 'Mercado', descricao: 'Mercado', data: hoje(), carteira_id: null } }),
    );
    enviar('gastei 45 no mercado');
    const card = await screen.findByTestId('card-gasto-ia');
    expect(fetchMock).toHaveBeenCalledWith('/api/ia/chat', expect.objectContaining({ method: 'POST', body: JSON.stringify({ mensagem: 'gastei 45 no mercado' }) }));
    expect(card.textContent).toMatch(/R\$\s*45,00/);
    expect(screen.getByTestId('ia-categoria').textContent).toBe('Mercado');
    expect(screen.getByTestId('ia-data').textContent).toBe('Hoje');
    // A rota grava a mensagem; o navegador só atualiza o histórico.
    expect(mutation.mutateAsync.mock.calls.map((c) => c[0].role)).toEqual([]);
    expect(refetchChat).toHaveBeenCalledOnce();
    expect(gasteiMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('card-gasto-ia')).toBeNull();
    expect(gasteiMutate).not.toHaveBeenCalled();
    expect(agentes()).toEqual([{ role: 'agent', conteudo: 'Tudo bem, não salvei esse gasto.' }]);
  });

  it('Confirmar grava uma vez pelo "Gastei" e fecha o card', async () => {
    fetchMock.mockImplementation(() =>
      respostaIa({ fallback: false, gravada: true, proposta: { valor: 45, categoria: 'Mercado', descricao: 'Mercado', data: hoje(), carteira_id: null } }),
    );
    enviar('gastei 45 no mercado');
    await screen.findByTestId('card-gasto-ia');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate).toHaveBeenCalledTimes(1);
    expect(gasteiMutate.mock.calls[0]![0]).toEqual({ valor: 45, categoria: 'Mercado', descricao: 'Mercado', carteira_id: 'c1', data: hoje() });
    gasteiMutate.mock.calls[0]![1].onSuccess();
    await waitFor(() => expect(screen.queryByTestId('card-gasto-ia')).toBeNull());
    expect(agentes()[0].conteudo).toMatch(/Gasto salvo: R\$\s*45,00 em Mercado/);
  });

  it.each([
    ['rota respondeu fallback', () => respostaIa({ fallback: true, gravada: true }), ['agent']],
    ['401', () => Promise.resolve(new Response('x', { status: 401 })), ['user', 'agent']],
    ['400', () => Promise.resolve(new Response('x', { status: 400 })), ['user', 'agent']],
    ['timeout', () => Promise.reject(new DOMException('timeout', 'TimeoutError')), ['user', 'agent']],
    ['LLM/rota caída (rede)', () => Promise.reject(new TypeError('fetch failed')), ['user', 'agent']],
    ['rota com erro 500', () => Promise.resolve(new Response('x', { status: 500 })), ['user', 'agent']],
  ])('fallback (%s): cai em processarMensagem, sem card e sem erro na tela', async (_nome, resposta, ordem) => {
    fetchMock.mockImplementation(resposta);
    enviar('gastei 45 no mercado');
    await waitFor(() => expect(agentes()).toHaveLength(1));
    expect(mutation.mutateAsync.mock.calls.map((c) => c[0].role)).toEqual(ordem);
    // Resposta do motor de regras, igual a antes da IA.
    expect(agentes()[0]).toMatchObject({
      conteudo: 'Sem movimentações financeiras registradas este mês.',
      acoes: [{ label: 'Ver Finanças', acao: 'NAVEGAR', payload: { rota: '/financas' } }],
    });
    expect(screen.queryByTestId('card-gasto-ia')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(gasteiMutate).not.toHaveBeenCalled();
  });

  it.each(['abrir minhas notas', 'como estão minhas finanças?', 'quanto gastei este mês?'])('atalho %s segue nas regras, sem chamar a IA', async (texto) => {
    enviar(texto);
    await waitFor(() => expect(agentes()).toHaveLength(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mutation.mutateAsync.mock.calls[0]?.[0]).toEqual({ role: 'user', conteudo: texto });
  });
});
