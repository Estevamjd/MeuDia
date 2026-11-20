// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { Transacao } from '@meudia/shared';
import { CampoParcelado, avaliarParcelas, planoParcelas, textoPrevia } from '../CampoParcelado';
import { LancamentoRapidoSheet } from '../LancamentoRapidoSheet';
import { useLancamentoModais } from '../LancamentoModais';
import { LinhaLancamento } from '../LinhaLancamento';
import { UltimosLancamentos } from '../resumo/UltimosLancamentos';
import { ConfirmarExclusao } from '../ConfirmarExclusao';
import { useExclusaoLancamento } from '../useExclusaoLancamento';

const NUBANK = { id: 'nu', nome: 'Nubank', tipo: 'banco', arquivada: false };
const m = vi.hoisted(() => ({
  gastei: vi.fn(), parcelar: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn(), excluirParcelas: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@meudia/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('../../../lib/hoje', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('../../../hooks', () => ({
  useCarteiras: () => ({ data: [NUBANK], isLoading: false, isPending: false, isSuccess: true }),
  usePainelSaldo: () => ({ data: { carteiraPadraoId: 'nu' } }),
  useGastei: () => ({ mutate: m.gastei, isPending: false }),
  useCriarDespesaParcelada: () => ({ mutate: m.parcelar, isPending: false }),
  useEntrouDinheiro: () => ({ mutate: vi.fn(), isPending: false }),
  useTransferir: () => ({ mutate: vi.fn(), isPending: false }),
  useCriarTransacao: () => ({ mutate: m.criar, isPending: false }),
  useAtualizarTransacao: () => ({ mutate: m.atualizar, isPending: false }),
  useVinculosTransacoes: () => ({ data: { recebimentos: [], pagamentos: [] }, isSuccess: true, refetch: vi.fn() }),
  useDesfazerRecebimento: () => ({ mutate: vi.fn(), isPending: false }),
  useDesfazerPagamento: () => ({ mutate: vi.fn(), isPending: false }),
  useExcluirTransacao: () => ({ mutate: m.excluir, isPending: false }),
  useExcluirParcelasDesde: () => ({ mutate: m.excluirParcelas, isPending: false }),
}));
vi.mock('../../ui', async (original) => ({ ...await original<object>(), useToast: () => m.toast }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
const t = (el: HTMLElement | null) => (el?.textContent ?? '').replace(/\s/g, ' ');
const sp = (s: string) => s.replace(/\s/g, ' ');
const interruptor = () => screen.getByRole('switch', { name: 'Parcelado no cartão' });

describe('prévia das parcelas (dividirParcelas)', () => {
  it('"10× de R$ 12,34 (1ª R$ 12,40)": o resto em centavos vai na 1ª; iguais não repetem a 1ª', () => {
    expect(sp(textoPrevia(planoParcelas(123.46, 10, '2026-11-20')!))).toBe('10× de R$ 12,34 (1ª R$ 12,40)');
    expect(sp(textoPrevia(planoParcelas(30, 3, '2026-11-20')!))).toBe('3× de R$ 10,00');
  });
  it('valor vazio/zero ou com mais de 2 casas: sem plano (o campo pede o total)', () => {
    expect(planoParcelas(0, 3, '2026-11-20')).toBeNull();
    expect(planoParcelas(10.005, 3, '2026-11-20')).toBeNull();
  });
  it('R$ 0,01 em 2× (menos de 1 centavo por parcela): mostra a validação de dividirParcelas, não o convite a digitar', () => {
    const MSG = 'O valor total precisa ser de pelo menos R$ 0,01 por parcela.';
    expect(avaliarParcelas(0.01, 2, '2026-11-20')).toEqual({ plano: null, erro: MSG });
    expect(avaliarParcelas(0, 2, '2026-11-20')).toEqual({ plano: null, erro: null });
    render(<CampoParcelado ligado onLigado={vi.fn()} parcelas={2} onParcelas={vi.fn()} total={0.01} dataPrimeira="2026-11-20" />);
    const previa = screen.getByTestId('parcelas-previa');
    expect(t(previa)).toBe(MSG);
    expect(previa.getAttribute('data-erro')).toBe('true');
    expect(previa.className).toContain('text-red');
  });
  it('stepper de 2× a 24×; prévia e datas da 1ª e da última (outro ano com /aa)', () => {
    const onParcelas = vi.fn();
    const { rerender } = render(<CampoParcelado ligado onLigado={vi.fn()} parcelas={2} onParcelas={onParcelas} total={100} dataPrimeira="2026-11-20" />);
    expect((screen.getByRole('button', { name: 'Menos uma parcela' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mais uma parcela' }));
    expect(onParcelas).toHaveBeenCalledWith(3);
    rerender(<CampoParcelado ligado onLigado={vi.fn()} parcelas={24} onParcelas={onParcelas} total={100} dataPrimeira="2026-11-20" />);
    expect((screen.getByRole('button', { name: 'Mais uma parcela' }) as HTMLButtonElement).disabled).toBe(true);
    expect(t(screen.getByTestId('parcelas-previa'))).toBe('24× de R$ 4,16 (1ª R$ 4,32)');
    expect(t(screen.getByTestId('campo-parcelado'))).toContain('A 1ª cai em 20/11 e a última em 20/10/28.');
    for (const b of screen.getAllByRole('button')) expect(b.className).toMatch(/h-11|min-h-\[44px\]/);
  });
});

describe('Gastei: parcelado no cartão', () => {
  const abrir = () => render(<LancamentoRapidoSheet open inicial="gastei" onClose={() => undefined} />);

  it('desligado: salva o gasto à vista como antes', () => {
    abrir();
    expect(interruptor().getAttribute('aria-checked')).toBe('false');
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar gasto' }));
    expect(m.gastei).toHaveBeenCalledTimes(1);
    expect(m.parcelar).not.toHaveBeenCalled();
  });

  it('ligado: o valor é o TOTAL, prévia ao vivo e envia base + total + parcelas (1ª na data escolhida)', () => {
    abrir();
    fireEvent.click(interruptor());
    expect(screen.getByLabelText('Valor total da compra')).toBeTruthy();
    expect(t(screen.getByTestId('parcelas-previa'))).toBe('Digite o valor total da compra.');
    fireEvent.change(screen.getByLabelText('Valor total da compra'), { target: { value: '12346' } });
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: 'Mais uma parcela' }));
    expect(t(screen.getByTestId('parcelas-previa'))).toBe('10× de R$ 12,34 (1ª R$ 12,40)');
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: 'Fone' } });
    fireEvent.change(screen.getByLabelText('Quando'), { target: { value: '2026-11-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar compra' }));
    expect(m.gastei).not.toHaveBeenCalled();
    expect(m.parcelar).toHaveBeenCalledWith(
      {
        base: { tipo: 'despesa', categoria: 'Outros', descricao: 'Fone', valor: 123.46, data: '2026-11-10', carteira_id: 'nu', banco: 'Nubank', ajuste: false },
        total: 123.46,
        parcelas: 10,
      },
      expect.anything(),
    );
    const { onSuccess } = m.parcelar.mock.calls[0]![1] as { onSuccess: () => void };
    act(() => onSuccess());
    expect(sp(m.toast.success.mock.calls[0]![0] as string)).toBe('Compra salva em 10× de R$ 12,34');
  });
});

describe('Gastei parcelado: trava e validação', () => {
  const abrir = () => render(<LancamentoRapidoSheet open inicial="gastei" onClose={() => undefined} />);
  const ligarCom = (digitos: string) => {
    abrir();
    fireEvent.click(interruptor());
    fireEvent.change(screen.getByLabelText('Valor total da compra'), { target: { value: digitos } });
  };

  it('dois envios seguidos (antes de o isPending chegar ao botão) gravam UM grupo só; a trava solta quando a gravação termina', () => {
    ligarCom('3000');
    const form = screen.getByRole('button', { name: 'Salvar compra' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(m.parcelar).toHaveBeenCalledTimes(1);
    // Falhou (onError + onSettled): pode tentar de novo, e de novo um envio só por vez.
    const opcoes = m.parcelar.mock.calls[0]![1] as { onError: () => void; onSettled: () => void };
    act(() => {
      opcoes.onError();
      opcoes.onSettled();
    });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(m.parcelar).toHaveBeenCalledTimes(2);
  });

  it('R$ 0,01 em 2×: o erro do Valor é a validação de dividirParcelas e nada é gravado', () => {
    ligarCom('1');
    expect(t(screen.getByTestId('parcelas-previa'))).toBe('O valor total precisa ser de pelo menos R$ 0,01 por parcela.');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar compra' }));
    expect(m.parcelar).not.toHaveBeenCalled();
    expect(screen.getAllByText('O valor total precisa ser de pelo menos R$ 0,01 por parcela.').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Informe o valor total da compra.')).toBeNull();
  });
});

describe('Novo lançamento parcelado: trava e validação', () => {
  const abrirParcelado = (valor: string) => {
    render(<Modais />);
    fireEvent.click(screen.getByText('abrir novo'));
    const dialogo = screen.getByRole('dialog', { name: 'Novo lançamento' });
    fireEvent.click(within(dialogo).getByRole('switch', { name: 'Parcelado no cartão' }));
    fireEvent.change(within(dialogo).getByLabelText('Categoria'), { target: { value: 'Compras' } });
    fireEvent.change(within(dialogo).getByLabelText('Descrição'), { target: { value: 'Fone' } });
    fireEvent.change(within(dialogo).getByLabelText('Valor total da compra (R$)'), { target: { value: valor } });
    return within(dialogo).getByRole('button', { name: 'Salvar' }).closest('form')!;
  };

  it('dois envios seguidos gravam UM grupo só; depois de terminar (onSettled), libera', () => {
    const form = abrirParcelado('30');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(m.parcelar).toHaveBeenCalledTimes(1);
    const opcoes = m.parcelar.mock.calls[0]![1] as { onError: () => void; onSettled: () => void };
    act(() => {
      opcoes.onError();
      opcoes.onSettled();
    });
    fireEvent.submit(form);
    expect(m.parcelar).toHaveBeenCalledTimes(2);
  });

  it('R$ 0,01 em 2×: toast com a validação de dividirParcelas (não "até 2 casas decimais"), nada gravado', () => {
    const form = abrirParcelado('0.01');
    expect(t(screen.getByTestId('parcelas-previa'))).toBe('O valor total precisa ser de pelo menos R$ 0,01 por parcela.');
    fireEvent.submit(form);
    expect(m.parcelar).not.toHaveBeenCalled();
    expect(m.toast.error).toHaveBeenCalledWith('O valor total precisa ser de pelo menos R$ 0,01 por parcela.');
  });
});

function Modais({ editar }: { editar?: Transacao }) {
  const { abrirNovo, abrirEdicao, modais } = useLancamentoModais();
  return (
    <>
      <button onClick={abrirNovo}>abrir novo</button>
      {editar && <button onClick={() => abrirEdicao(editar)}>abrir edição</button>}
      {modais}
    </>
  );
}
const parcela = (num: number, total = 3): Transacao => ({
  id: `p${num}`, user_id: 'u', tipo: 'despesa', categoria: 'Compras', descricao: 'Fone', valor: 10, data: '2026-11-20', banco: 'Nubank',
  automatico: false, created_at: '2026-11-20T12:00:00Z', carteira_id: 'nu', ajuste: false, origem: 'app',
  parcela_grupo: 'g1', parcela_num: num, parcela_total: total,
});

describe('Novo lançamento / Editar: parcelado só em despesa nova', () => {
  it('despesa nova parcelada: envia pelo useCriarDespesaParcelada com o total; receita não oferece', () => {
    render(<Modais />);
    fireEvent.click(screen.getByText('abrir novo'));
    const dialogo = screen.getByRole('dialog', { name: 'Novo lançamento' });
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'receita' } });
    expect(within(dialogo).queryByRole('switch')).toBeNull();
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'despesa' } });
    fireEvent.click(within(dialogo).getByRole('switch', { name: 'Parcelado no cartão' }));
    fireEvent.change(within(dialogo).getByLabelText('Categoria'), { target: { value: 'Compras' } });
    fireEvent.change(within(dialogo).getByLabelText('Descrição'), { target: { value: 'Fone' } });
    fireEvent.change(within(dialogo).getByLabelText('Valor total da compra (R$)'), { target: { value: '30' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Mais uma parcela' }));
    expect(t(within(dialogo).getByTestId('parcelas-previa'))).toBe('3× de R$ 10,00');
    fireEvent.submit(within(dialogo).getByRole('button', { name: 'Salvar' }).closest('form')!);
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.parcelar).toHaveBeenCalledWith(
      { base: expect.objectContaining({ tipo: 'despesa', categoria: 'Compras', descricao: 'Fone', valor: 30, data: '2026-11-20', carteira_id: 'nu', banco: 'Nubank' }), total: 30, parcelas: 3 },
      expect.anything(),
    );
  });

  it('editar uma parcela: nota "muda só esta", sem Tipo nem parcelado; o payload não mexe nas colunas de parcela', () => {
    render(<Modais editar={parcela(2)} />);
    fireEvent.click(screen.getByText('abrir edição'));
    const dialogo = screen.getByRole('dialog', { name: 'Editar lançamento' });
    expect(t(within(dialogo).getByTestId('nota-parcela-edicao'))).toBe('Parcela 2/3. Você muda só esta; as outras ficam como estão.');
    expect(within(dialogo).queryByLabelText('Tipo')).toBeNull();
    expect(within(dialogo).queryByRole('switch')).toBeNull();
    fireEvent.change(within(dialogo).getByLabelText('Valor (R$)'), { target: { value: '12' } });
    fireEvent.submit(within(dialogo).getByRole('button', { name: 'Salvar' }).closest('form')!);
    const [{ id, data }] = m.atualizar.mock.calls[0]! as [{ id: string; data: Record<string, unknown> }];
    expect(id).toBe('p2');
    expect(data).toMatchObject({ tipo: 'despesa', valor: 12 });
    expect(Object.keys(data).some((k) => k.startsWith('parcela_'))).toBe(false);
  });

  it('editar lançamento à vista: sem nota de parcela e sem oferecer parcelar', () => {
    render(<Modais editar={{ ...parcela(1), parcela_grupo: null, parcela_num: null, parcela_total: null }} />);
    fireEvent.click(screen.getByText('abrir edição'));
    const dialogo = screen.getByRole('dialog', { name: 'Editar lançamento' });
    expect(within(dialogo).queryByTestId('nota-parcela-edicao')).toBeNull();
    expect(within(dialogo).queryByRole('switch')).toBeNull();
  });
});

describe('selo "k/N" nas linhas', () => {
  it('Gastos (LinhaLancamento) e Início (Últimos lançamentos) mostram 2/3; à vista não mostra', () => {
    render(
      <ul>
        <LinhaLancamento t={parcela(2)} />
        <LinhaLancamento t={{ ...parcela(1), id: 'v', parcela_grupo: null, parcela_num: null, parcela_total: null }} />
      </ul>,
    );
    const selos = screen.getAllByTestId('selo-parcela');
    expect(selos.map(t)).toEqual(['2/3']);
    expect(selos[0]!.getAttribute('aria-label')).toBe('Parcela 2 de 3');
    cleanup();
    render(<UltimosLancamentos lancamentos={[parcela(3)]} />);
    expect(t(screen.getByTestId('selo-parcela'))).toBe('3/3');
  });
});

describe('excluir parcela: só esta ou esta e as próximas', () => {
  const montar = () => renderHook(() => useExclusaoLancamento(['p2'])).result;

  it('parcela 2/3: diálogo com "Só esta parcela" (DELETE pelo id) e "Esta e as próximas (2 a 3)" (excluirParcelasDesde)', () => {
    const r = montar();
    act(() => r.current.pedirExclusao(parcela(2)));
    const e = r.current.exclusao!;
    expect(e.detalhe).toBe('É a parcela 2/3 de uma compra no cartão. Escolha o que sai.');
    render(<ConfirmarExclusao isOpen onClose={e.onCancelar} onConfirm={e.onConfirmar} titulo="Excluir lançamento" detalhe={e.detalhe} parcela={e.parcela} />);
    const dialogo = screen.getByRole('dialog', { name: 'Excluir lançamento' });
    expect(t(dialogo)).toContain('Excluir? Isso não pode ser desfeito.');
    expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).toBeNull();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Só esta parcela' }));
    expect(m.excluir).toHaveBeenCalledWith('p2', expect.anything());
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Esta e as próximas (2 a 3)' }));
    expect(m.excluirParcelas).toHaveBeenCalledWith({ grupo: 'g1', aPartirDe: 2 }, expect.anything());
    const { onSuccess } = m.excluirParcelas.mock.calls[0]![1] as { onSuccess: () => void };
    act(() => onSuccess());
    expect(m.toast.success).toHaveBeenCalledWith('Parcelas 2 a 3 excluídas');
    expect(r.current.exclusao).toBeNull();
  });

  it('última parcela (3/3): confirmação comum (só ela sai), sem a escolha', () => {
    const r = montar();
    act(() => r.current.pedirExclusao(parcela(3)));
    expect(r.current.exclusao!.parcela).toBeNull();
    expect(r.current.exclusao!.detalhe).toBe('É a última parcela (3/3) de uma compra no cartão. As outras ficam.');
    act(() => r.current.exclusao!.onConfirmar());
    expect(m.excluir).toHaveBeenCalledWith('p3', expect.anything());
  });

  it('nada some antes de escolher; Cancelar fecha sem apagar', () => {
    const r = montar();
    act(() => r.current.pedirExclusao(parcela(1)));
    const e = r.current.exclusao!;
    render(<ConfirmarExclusao isOpen onClose={e.onCancelar} onConfirm={e.onConfirmar} titulo="Excluir lançamento" detalhe={e.detalhe} parcela={e.parcela} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(m.excluir).not.toHaveBeenCalled();
    expect(m.excluirParcelas).not.toHaveBeenCalled();
    expect(r.current.exclusao).toBeNull();
  });
});
