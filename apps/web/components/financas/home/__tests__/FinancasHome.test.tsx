// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ContaPagar, OcorrenciaConta, SobraDoMes, Transacao } from '@meudia/shared';
import { BoasVindasFinancas } from '../BoasVindasFinancas';
import { RendaSheet } from '../RendaSheet';
import { FinancasHomeView, type DashboardHome, type FinancasHomeViewProps } from '../FinancasHomeView';
import { montarHome, type ResumoHome } from '../montarHome';
import { ProximasContas } from '../ProximasContas';

afterEach(cleanup);

const HOJE = '2026-10-16';
/** Intl usa NBSP entre "R$" e o número. */
const texto = (el: HTMLElement = document.body) => (el.textContent ?? '').replace(/\s/g, ' ');
const semTransacaoSemAcento = () => expect(texto()).not.toMatch(/transac[aã]o|Transacao|transacoes/i);

const conta = (id: string, descricao: string, valor: number): ContaPagar => ({
  id, user_id: 'u1', assinatura_id: null, descricao, categoria: 'Moradia', valor, recorrencia: 'mensal',
  dia_vencimento: 10, mes_vencimento: null, data_vencimento: null, ativo: true, created_at: null, updated_at: null,
});
const ocorrencia = (c: ContaPagar, vencimento: string, situacao: OcorrenciaConta['situacao']): OcorrenciaConta => ({
  conta: c, competencia: '2026-10', vencimento, situacao,
  pagamento: situacao === 'paga'
    ? { id: `p-${c.id}`, conta_id: c.id, user_id: 'u1', competencia: '2026-10', pago_em: vencimento, transacao_id: null, created_at: null }
    : null,
});
const transacao = (id: string, descricao: string, valor: number, data: string, tipo: Transacao['tipo'] = 'despesa', categoria = 'Alimentação'): Transacao => ({
  id, user_id: 'u1', tipo, categoria, descricao, valor, data, banco: null, automatico: false, created_at: `${data}T12:00:00Z`,
});
const resumo = (over: Partial<ResumoHome> = {}): ResumoHome => ({ rendaPrevista: 5000, rendaReal: 5000, ...over });

const ocorrencias = [
  ocorrencia(conta('c1', 'Luz', 180), '2026-10-16', 'pendente'),
  ocorrencia(conta('c2', 'Internet', 99.9), '2026-10-12', 'vencida'),
  ocorrencia(conta('c3', 'Aluguel', 1500), '2026-10-05', 'paga'),
  ocorrencia(conta('c4', 'Academia', 120), '2026-10-25', 'pendente'),
  ocorrencia(conta('c5', 'Streaming', 39.9), '2026-10-28', 'pendente'),
];
const transacoes = [
  ...Array.from({ length: 7 }, (_, i) => transacao(`t${i}`, `Mercado ${i + 1}`, 50 + i, `2026-10-${String(i + 1).padStart(2, '0')}`)),
  transacao('rec', 'Pix', 150, '2026-10-15', 'receita', 'Entrada extra'),
  { ...transacao('aj', 'Ajuste', 30, '2026-10-15'), ajuste: true },
];
const sobra: SobraDoMes = {
  competencia: '2026-10', renda: { lancada: 0, aReceber: 2000, total: 2000 }, rendasAReceber: [], despesasLancadas: 1200,
  contasAPagar: [], despesas: 1500, valor: 500,
};
const dashboard = (over: Partial<DashboardHome> = {}): DashboardHome => ({
  saldo: { total: 1280, carteiras: [{ id: 'n', nome: 'Nubank', saldo: 980, noTotal: true }, { id: 'c', nome: 'Caixa', saldo: 300, noTotal: true }], comecouMes: null, nomeMes: 'outubro' },
  sobraMes: sobra,
  rendasAReceber: [{ rendaId: 'r1', descricao: 'Salário', valor: 2000, data: '2026-10-20', competencia: '2026-10' }],
  fatias: [], evolucao: [], escondido: false, onAlternarOlho: vi.fn(), onRecebi: vi.fn(),
  recebiSheet: { renda: null, carteiras: [], carteiraPadrao: null, salvando: false, onClose: vi.fn(), onConfirmar: vi.fn() },
  ...over,
});

const viewProps = (over: Partial<FinancasHomeViewProps> = {}, dados: Partial<Parameters<typeof montarHome>[0]> = {}): FinancasHomeViewProps => ({
  estado: 'pronto',
  hojeISO: HOJE,
  secoes: montarHome({
    competencia: '2026-10', hojeISO: HOJE, resumo: resumo(), ocorrencias, transacoes, ...dados,
  }),
  boasVindas: null,
  rendaSheet: { open: false, onClose: vi.fn(), onSalvar: vi.fn() },
  onPagar: vi.fn(),
  onGastei: vi.fn(),
  dashboard: dashboard(),
  ...over,
});

describe('ProximasContas', () => {
  it('"Paguei" em 1 toque chama onPagar com a conta', () => {
    const onPagar = vi.fn();
    const contas = [
      { contaId: 'c1', competencia: '2026-10', descricao: 'Luz', valor: 180, vencimento: HOJE, situacao: 'pendente' as const },
      { contaId: 'c4', competencia: '2026-10', descricao: 'Academia', valor: 120, vencimento: '2026-10-18', situacao: 'pendente' as const },
    ];
    render(<ProximasContas contas={contas} totalMes={5} hojeISO={HOJE} onPagar={onPagar} />);
    expect(texto()).toContain('vence hoje');
    expect(texto()).toContain('vence em 2 dias');
    expect(texto()).toContain('R$ 180,00');
    fireEvent.click(screen.getByRole('button', { name: 'Paguei Luz' }));
    expect(onPagar).toHaveBeenCalledWith(contas[0]);
    expect(screen.getByRole('link', { name: 'Ver todas as contas (5)' }).getAttribute('href')).toBe('/financas/contas');
  });

  it('tudo pago: mensagem em vez da lista', () => {
    render(<ProximasContas contas={[]} totalMes={2} hojeISO={HOJE} onPagar={vi.fn()} />);
    expect(texto()).toContain('Todas as contas do mês estão pagas.');
    expect(screen.queryByRole('button', { name: /Paguei/ })).toBeNull();
  });
});

describe('BoasVindasFinancas', () => {
  const segmentosAtivos = () =>
    Array.from(screen.getByTestId('progresso-passos').children).filter((s) => s.className.includes('bg-accent')).length;

  it('passo 1 (sem renda): só "Cadastrar minha renda", Passo 1 de 2', () => {
    const onCadastrarRenda = vi.fn();
    render(<BoasVindasFinancas rendaCadastrada={false} onCadastrarRenda={onCadastrarRenda} />);
    expect(texto()).toContain('Passo 1 de 2');
    expect(segmentosAtivos()).toBe(1);
    expect(texto()).toContain('Vamos montar seu mês');
    expect(screen.queryByRole('link', { name: 'Adicionar conta' })).toBeNull();
    expect(texto()).not.toMatch(/iPhone|Tela de Início|lembrete|Ou registre um lançamento/i);
    const botao = screen.getByRole('button', { name: 'Cadastrar minha renda' });
    expect(botao.className).toContain('w-full');
    fireEvent.click(botao);
    expect(onCadastrarRenda).toHaveBeenCalled();
  });

  it('passo 2 (renda cadastrada): "Adicionar conta", Passo 2 de 2', () => {
    render(<BoasVindasFinancas rendaCadastrada onCadastrarRenda={vi.fn()} />);
    expect(texto()).toContain('Passo 2 de 2');
    expect(segmentosAtivos()).toBe(2);
    expect(screen.getByRole('link', { name: 'Adicionar conta' }).getAttribute('href')).toBe('/financas/contas?nova=1');
    expect(screen.queryByRole('button', { name: 'Cadastrar minha renda' })).toBeNull();
  });
});

describe('RendaSheet', () => {
  const abrir = (over: Partial<Parameters<typeof RendaSheet>[0]> = {}) => {
    const onSalvar = vi.fn();
    render(<RendaSheet open onClose={vi.fn()} onSalvar={onSalvar} {...over} />);
    return { onSalvar, valor: screen.getByLabelText('Valor') as HTMLInputElement, dia: screen.getByLabelText('Dia que recebe (opcional)') as HTMLInputElement };
  };

  it('título e campos; fechado não renderiza', () => {
    const { rerender } = render(<RendaSheet open={false} onClose={vi.fn()} onSalvar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<RendaSheet open onClose={vi.fn()} onSalvar={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Sua renda do mês');
    expect(screen.getByLabelText('Valor').getAttribute('inputmode')).toBe('decimal');
  });

  it('máscara BRL: digitar 480000 mostra R$ 4.800,00', () => {
    const { valor } = abrir();
    fireEvent.change(valor, { target: { value: '480000' } });
    expect(valor.value.replace(/\s/g, ' ')).toBe('R$ 4.800,00');
    // Apagar o último caractere tira um dígito.
    fireEvent.change(valor, { target: { value: 'R$ 4.800,0' } });
    expect(valor.value.replace(/\s/g, ' ')).toBe('R$ 480,00');
  });

  it('valida valor obrigatório > 0 e dia 1–31 em pt-BR', () => {
    const { onSalvar, valor, dia } = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(texto()).toContain('Informe um valor maior que zero.');
    fireEvent.change(valor, { target: { value: '000' } });
    fireEvent.change(dia, { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(texto()).toContain('Informe um valor maior que zero.');
    expect(texto()).toContain('O dia vai de 1 a 31.');
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('salvar envia valor em reais e o dia (ou null)', () => {
    const { onSalvar, valor, dia } = abrir();
    fireEvent.change(valor, { target: { value: '480000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSalvar).toHaveBeenLastCalledWith(4800, null);
    fireEvent.change(dia, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSalvar).toHaveBeenLastCalledWith(4800, 5);
  });

  it('mostra o erro recebido', () => {
    abrir({ erro: 'Não foi possível salvar a renda. Tente de novo.' });
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível salvar a renda. Tente de novo.');
  });
});

describe('montarHome (Início resumida)', () => {
  it('contas a vencer: até 2 não pagas, vencidas primeiro; últimos gastos: 3 despesas mais recentes (sem receita/ajuste)', () => {
    const s = montarHome({ competencia: '2026-10', hojeISO: HOJE, resumo: resumo(), ocorrencias, transacoes });
    expect(s.contasAVencer?.contas.map((c) => c.descricao)).toEqual(['Internet', 'Luz']);
    expect(s.contasAVencer?.totalMes).toBe(5);
    expect(s.ultimosGastos.map((t) => t.descricao)).toEqual(['Mercado 7', 'Mercado 6', 'Mercado 5']);
  });

  it('uma sobra só: nada de HeroSobra, Entrou/Saiu, chips ou alerta separado na Início', () => {
    const s = montarHome({ competencia: '2026-10', hojeISO: HOJE, resumo: resumo(), ocorrencias, transacoes });
    expect(Object.keys(s).sort()).toEqual(['contasAVencer', 'ultimosGastos', 'vazio']);
  });

  it('sem renda: vazio; sem contas: sem card', () => {
    const s = montarHome({ competencia: '2026-10', hojeISO: HOJE, ocorrencias: [], transacoes: [], resumo: resumo({ rendaPrevista: 0, rendaReal: 0 }) });
    expect(s.vazio).toBe(true);
    expect(s.contasAVencer).toBeNull();
  });
});

describe('FinancasHomeView (Início resumida, decisão 7)', () => {
  const regioes = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby') && document.getElementById(r.getAttribute('aria-labelledby')!)?.textContent);

  it('só Cofrinho → No fim do mês sobra → Contas a vencer → Últimos gastos, nessa ordem', () => {
    render(<FinancasHomeView {...viewProps()} />);
    expect(regioes()).toEqual(['Cofrinho', 'No fim do mês sobra', 'Contas a vencer', 'Últimos gastos']);
    expect(texto()).not.toMatch(/Prevista|Entrou|Renda comprometida|Pagas em dia|Gastos do mês por categoria|Evolução do mês|Ative os lembretes|pedem atenção|Orçamento/);
    expect(screen.queryByRole('alert')).toBeNull();
    semTransacaoSemAcento();
  });

  it('No fim do mês sobra com barra: % usado = despesas ÷ renda do mês, limitado a 100', () => {
    const { rerender } = render(<FinancasHomeView {...viewProps()} />);
    const barra = screen.getByRole('progressbar', { name: 'Renda do mês usada' });
    expect(barra.getAttribute('aria-valuenow')).toBe('75');
    expect(texto()).toContain('usou 75%');
    rerender(<FinancasHomeView {...viewProps({ dashboard: dashboard({ sobraMes: { ...sobra, despesas: 3000, valor: -1000 } }) })} />);
    expect(screen.getByRole('progressbar', { name: 'Renda do mês usada' }).getAttribute('aria-valuenow')).toBe('100');
    expect(texto()).toContain('usou 150%');
  });

  it('Contas a vencer: vencida destacada no card, "Ver todas" e a linha "A receber" com Recebi', () => {
    const onRecebi = vi.fn();
    render(<FinancasHomeView {...viewProps({ dashboard: dashboard({ onRecebi }) })} />);
    const card = screen.getByRole('region', { name: 'Contas a vencer' });
    expect(card.querySelectorAll('[data-conta]')).toHaveLength(2);
    expect(screen.getByText('venceu há 4 dias', { exact: false }).className).toContain('text-red');
    expect(screen.getByRole('link', { name: 'Ver todas as contas (5)' }).getAttribute('href')).toBe('/financas/contas');
    expect(texto()).toContain('A receber: Salário dia 20');
    fireEvent.click(screen.getByRole('button', { name: 'Recebi Salário' }));
    expect(onRecebi).toHaveBeenCalledWith(expect.objectContaining({ rendaId: 'r1' }));
  });

  it('Últimos gastos: 3 itens, "Ver todos" leva a Gastos e "Gastei" abre o lançamento', () => {
    const onGastei = vi.fn();
    render(<FinancasHomeView {...viewProps({ onGastei })} />);
    const card = screen.getByRole('region', { name: 'Últimos gastos' });
    expect(card.querySelectorAll('li')).toHaveLength(3);
    expect(card.textContent).not.toContain('Pix');
    expect(screen.getByRole('link', { name: /Ver todos os gastos/ }).getAttribute('href')).toBe('/financas/gastos');
    fireEvent.click(screen.getByRole('button', { name: 'Gastei' }));
    expect(onGastei).toHaveBeenCalled();
  });

  it('"Paguei" na home chama onPagar', () => {
    const onPagar = vi.fn();
    render(<FinancasHomeView {...viewProps({ onPagar })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paguei Internet' }));
    expect(onPagar).toHaveBeenCalledWith(expect.objectContaining({ contaId: 'c2', competencia: '2026-10' }));
  });

  it('renda cadastrada sem contas: card no passo 2 acima do resumo', () => {
    render(<FinancasHomeView {...viewProps({ boasVindas: { rendaCadastrada: true, onCadastrarRenda: vi.fn() } })} />);
    expect(texto()).toContain('Passo 2 de 2');
    expect(texto()).toContain('No fim do mês sobra');
  });

  it('usuária nova (vazio, sem banco): só o convite e as boas-vindas, sem "R$ 0,00"', () => {
    const onCadastrarRenda = vi.fn();
    const props = viewProps({ boasVindas: { rendaCadastrada: false, onCadastrarRenda }, dashboard: dashboard({ saldo: { total: 0, carteiras: [], comecouMes: null, nomeMes: 'outubro' } }) }, {
      resumo: resumo({ rendaPrevista: 0, rendaReal: 0 }), ocorrencias: [], transacoes: [],
    });
    render(<FinancasHomeView {...props} />);
    expect(props.secoes?.vazio).toBe(true);
    expect(texto()).toContain('Vamos montar seu mês');
    expect(texto()).not.toContain('R$');
    expect(texto()).not.toMatch(/No fim do mês sobra|Contas a vencer|Últimos gastos/);
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar minha renda' }));
    expect(onCadastrarRenda).toHaveBeenCalled();
  });

  it('carregando e erro', () => {
    const onTentarDeNovo = vi.fn();
    const { rerender } = render(<FinancasHomeView {...viewProps({ estado: 'carregando', secoes: null })} />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    rerender(<FinancasHomeView {...viewProps({ estado: 'erro', secoes: null, onTentarDeNovo })} />);
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar o resumo do mês.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onTentarDeNovo).toHaveBeenCalled();
  });
});

it('erro amigável do painel mantém o resumo e bloqueia Paguei enquanto bancos não carregam', () => {
  const pagar = vi.fn();
  render(<FinancasHomeView {...viewProps({ dashboard: null, erroPainel: 'O MeuDia está terminando uma atualização. Tente de novo em alguns minutos.', pagamentoBloqueado: true, onPagar: pagar })} />);
  expect(screen.getAllByRole('alert').some((alerta) => alerta.textContent?.includes('terminando uma atualização'))).toBe(true);
  expect(texto()).toContain('Contas a vencer');
  for (const botao of screen.getAllByRole('button', { name: /^Paguei / })) {
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(botao);
  }
  expect(pagar).not.toHaveBeenCalled();
});
