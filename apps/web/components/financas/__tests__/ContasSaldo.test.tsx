// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PainelSaldo } from '@meudia/api';
import type { Carteira, ContaPagar, Renda, SobraDoMes } from '@meudia/shared';
import { CategoriaIcone } from '../CategoriaIcone';
import { SeletorCategoria } from '../SeletorCategoria';
import { SeletorCarteira } from '../SeletorCarteira';
import { CardSaldoHoje } from '../home/CardSaldoHoje';
import { CardSobraMes } from '../home/CardPrevisao';
import * as CardPrevisao from '../home/CardPrevisao';
import { CardRendaAReceber, textoRecebimento } from '../home/CardRendaAReceber';
import { GraficoCategorias } from '../home/GraficoCategorias';
import { montarDashboard } from '../home/montarDashboard';
import { montarCarteirasOnboarding } from '../../../lib/onboarding';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
afterEach(cleanup);

const texto = () => (document.body.textContent ?? '').replace(/\s/g, ' ');

describe('CategoriaIcone', () => {
  it('categoria conhecida usa o próprio ícone; desconhecida/legada cai em Outros', () => {
    const { container, rerender } = render(<CategoriaIcone categoria="Lanche" />);
    expect(container.querySelector('[data-categoria-icone]')?.getAttribute('data-categoria-icone')).toBe('Comida');
    rerender(<CategoriaIcone categoria="Cinema 3D" />);
    expect(container.querySelector('[data-categoria-icone]')?.getAttribute('data-categoria-icone')).toBe('Outros');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('SeletorCategoria', () => {
  it('grade em radiogroup; escolher chama onChange; legada aparece primeiro', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SeletorCategoria value="Outros" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Outros' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Comida' }));
    expect(onChange).toHaveBeenCalledWith('Comida');
    rerender(<SeletorCategoria value="Cinema" onChange={onChange} />);
    expect(screen.getAllByRole('radio')[0]!.textContent).toBe('Cinema');
    expect(screen.queryByRole('radio', { name: 'Salário' })).toBeNull();
  });
});

describe('SeletorCarteira', () => {
  it('chips com ≥44px; opção desabilitada não troca', () => {
    const onChange = vi.fn();
    render(
      <SeletorCarteira id="s" label="De" value="a" onChange={onChange} desabilitada="b"
        carteiras={[{ id: 'a', nome: 'Nubank', tipo: 'banco' }, { id: 'b', nome: 'Caixa', tipo: 'banco' }]} />,
    );
    const caixa = screen.getByRole('radio', { name: 'Caixa' }) as HTMLButtonElement;
    expect(caixa.disabled).toBe(true);
    expect(caixa.className).toContain('min-h-[44px]');
    fireEvent.click(screen.getByRole('radio', { name: 'Nubank' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('CardSaldoHoje', () => {
  const props = {
    total: 800, comecouMes: 500, nomeMes: 'outubro', escondido: false, onAlternarOlho: vi.fn(),
    carteiras: [{ id: 'n', nome: 'Nubank', saldo: 650, noTotal: true }, { id: 'c', nome: 'Caixa', saldo: 150, noTotal: true }],
  };
  it('total, chips por banco e "Começou outubro com"', () => {
    render(<CardSaldoHoje {...props} />);
    expect(texto()).toContain('Cofrinho');
    expect(texto()).toContain('R$ 800,00');
    expect(texto()).toContain('Nubank R$ 650,00');
    expect(texto()).toContain('Caixa R$ 150,00');
    expect(texto()).toContain('Começou outubro com R$ 500,00');
  });
  it('olho esconde todos os valores', () => {
    const onAlternarOlho = vi.fn();
    render(<CardSaldoHoje {...props} escondido onAlternarOlho={onAlternarOlho} />);
    expect(texto()).not.toMatch(/R\$ \d/);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar valores' }));
    expect(onAlternarOlho).toHaveBeenCalled();
  });
  it('sem carteira: convite, sem "R$ 0,00"', () => {
    render(<CardSaldoHoje {...props} carteiras={[]} total={0} comecouMes={null} />);
    expect(texto()).not.toContain('R$');
    expect(screen.getByRole('link', { name: 'Adicionar banco ou carteira' }).getAttribute('href')).toBe('/financas/carteiras?nova=1');
  });
  it('negativo em vermelho com explicação', () => {
    render(<CardSaldoHoje {...props} total={-20} />);
    expect(screen.getByTestId('saldo-hoje-valor').className).toContain('text-red');
    expect(texto()).toContain('Saldo negativo');
  });
});

describe('CardSobraMes (decisão final do Estevam)', () => {
  // Aceite: Salário 2.200 dia 1 sem Recebi, conta 110 dia 5 sem Paguei, nada lançado; guardado 235.
  const sobra: SobraDoMes = {
    competencia: '2026-10', renda: { lancada: 0, aReceber: 2200, total: 2200 },
    rendasAReceber: [{ id: 'r', descricao: 'Salário', valor: 2200, data: '2026-10-01' }],
    despesasLancadas: 0, contasAPagar: [{ id: 'net', descricao: 'Internet', categoria: 'Internet', valor: 110, vencimento: '2026-10-05' }],
    despesas: 110, valor: 2090,
  };
  const linha = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/g, ' ');

  it('"No fim do mês sobra": conta visível sem abrir nada; "por quê?" lista renda e cada conta', () => {
    render(<CardSobraMes sobra={sobra} escondido={false} />);
    expect(texto()).toContain('No fim do mês sobra');
    expect(linha('previsao-fim-mes-valor')).toBe('R$ 2.090,00');
    expect(linha('previsao-fim-mes-conta')).toBe('Renda R$ 2.200,00 − despesas R$ 110,00 = sobra R$ 2.090,00');
    expect(texto()).not.toContain('Internet');
    const botao = screen.getByRole('button', { name: 'por quê? No fim do mês sobra' });
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(texto()).toContain('+ Salário (sem "Recebi", dia 01/10)+R$ 2.200,00');
    expect(texto()).toContain('= Renda do mêsR$ 2.200,00');
    expect(texto()).toContain('− Internet (vence 05/10)−R$ 110,00');
    expect(texto()).toContain('= No fim do mês sobraR$ 2.090,00');
    expect(texto()).toContain('guardado nos bancos não entra');
    expect(texto()).not.toContain('Despesas lançadas no mês');
  });

  it('"No fim do mês sobra" com despesas lançadas e receitas; negativo em vermelho com "faltam"', () => {
    const negativa = { ...sobra, renda: { lancada: 100, aReceber: 0, total: 100 }, rendasAReceber: [], despesasLancadas: 290, despesas: 400, valor: -300 };
    render(<CardSobraMes sobra={negativa} escondido={false} />);
    expect(screen.getByTestId('previsao-fim-mes-valor').className).toContain('text-red');
    expect(linha('previsao-fim-mes-conta')).toBe('Renda R$ 100,00 − despesas R$ 400,00 = faltam R$ 300,00');
    expect(texto()).toContain('Faltam R$ 300,00');
    fireEvent.click(screen.getByRole('button', { name: 'por quê? No fim do mês sobra' }));
    expect(texto()).toContain('+ Receitas lançadas no mês+R$ 100,00');
    expect(texto()).toContain('− Despesas lançadas no mês−R$ 290,00');
  });

  it('ocultar valores esconde também a linha curta e o "por quê?"', () => {
    render(<CardSobraMes sobra={sobra} escondido />);
    for (const b of screen.getAllByRole('button', { name: /por quê\?/ })) fireEvent.click(b);
    expect(texto()).not.toMatch(/2\.200|2\.090|110/);
  });

  it('o card "Em 7 dias você terá" não existe mais', () => {
    expect(Object.keys(CardPrevisao)).toEqual(['CardSobraMes']);
  });
});

describe('CardRendaAReceber', () => {
  it('Recebi chama o callback com a renda', () => {
    const onRecebi = vi.fn();
    const renda = { rendaId: 'r', descricao: 'Salário', valor: 900, data: '2026-10-05', competencia: '2026-10' };
    render(<CardRendaAReceber rendas={[renda]} hojeISO="2026-10-17" onRecebi={onRecebi} />);
    expect(texto()).toContain('era para cair em 05/10');
    fireEvent.click(screen.getByRole('button', { name: 'Recebi Salário' }));
    expect(onRecebi).toHaveBeenCalledWith(renda);
    expect(textoRecebimento('2026-10-17', '2026-10-17')).toBe('cai hoje');
    expect(textoRecebimento('2026-10-20', '2026-10-17')).toBe('cai em 3 dias');
  });
});

describe('GraficoCategorias', () => {
  it('legenda com ícone, valor e %; vazio sem "R$ 0,00"', () => {
    const { rerender } = render(<GraficoCategorias fatias={[{ categoria: 'Comida', valor: 25 }]} escondido={false} />);
    expect(texto()).toContain('ComidaR$ 25,00100%');
    rerender(<GraficoCategorias fatias={[]} escondido={false} />);
    expect(texto()).toContain('Nenhum gasto neste mês ainda');
    expect(texto()).not.toContain('R$');
  });
});

describe('montarDashboard', () => {
  const carteira = (id: string, nome: string): Carteira => ({
    id, user_id: 'u', nome, tipo: 'banco', saldo_inicial: 0, saldo_inicial_em: '2026-10-17T15:00:00Z',
    incluir_no_total: true, arquivada: false, ordem: 0, created_at: null, updated_at: null,
  });
  const renda: Renda = { id: 'r', user_id: 'u', descricao: 'Salário', valor: 900, dia_recebimento: 5, ativo: true, created_at: '2026-10-17T15:04:00Z', updated_at: null };
  const contaLuz: ContaPagar = {
    id: 'luz', user_id: 'u', assinatura_id: null, descricao: 'Luz', categoria: 'Luz', valor: 120, recorrencia: 'mensal', dia_vencimento: 20,
    mes_vencimento: null, data_vencimento: null, ativo: true, created_at: '2026-10-17T15:00:00Z', updated_at: null,
  };
  const painel = {
    hojeISO: '2026-10-17', competencia: '2026-10', saldoHoje: 775, comecouMes: null,
    carteiras: [{ carteira: carteira('n', 'Nubank'), saldo: 675 }, { carteira: carteira('c', 'Caixa'), saldo: 100 }],
    arquivadas: [], mes: { rendas: [renda], recebimentos: [], contas: [contaLuz], pagamentos: [] },
    rendasAReceber: [{ renda: { id: 'r', descricao: 'Salário', valor: 900 }, competencia: '2026-10', data: '2026-10-05' }],
    carteiraPadraoId: 'n', transacoesCarteiras: [], transferencias: [],
  } as unknown as PainelSaldo;
  const gasto = { id: 't', user_id: 'u', tipo: 'despesa' as const, categoria: 'Comida', descricao: 'x', valor: 25, data: '2026-10-17', banco: null, automatico: false, created_at: '2026-10-17T15:10:00Z', carteira_id: 'n', ajuste: false };

  it('mês corrente: chips, sobra do mês, renda a receber, rosca e evolução', () => {
    const d = montarDashboard('2026-10', '2026-10-17', painel, [gasto]);
    expect(d.saldo.carteiras.map((c) => [c.nome, c.saldo])).toEqual([['Nubank', 675], ['Caixa', 100]]);
    expect(d.saldo.nomeMes).toBe('outubro');
    // Sobra = 900 (renda sem Recebi) − 25 (Gastei) − 120 (Luz) = 755. Sem "Em 7 dias".
    expect(d.sobraMes?.valor).toBe(755);
    expect(d).not.toHaveProperty('seteDias');
    expect(d.rendasAReceber).toEqual([{ rendaId: 'r', descricao: 'Salário', valor: 900, data: '2026-10-05', competencia: '2026-10' }]);
    expect(d.fatias).toEqual([{ categoria: 'Comida', valor: 25 }]);
    expect(d.evolucao).toHaveLength(17);
    expect(d.evolucao.at(-1)).toMatchObject({ dia: 17, gasto: 25 });
  });
  it('outro mês: sem previsões nem Recebi', () => {
    const d = montarDashboard('2026-09', '2026-10-17', painel, []);
    expect(d.sobraMes).toBeNull();
    expect(d.rendasAReceber).toEqual([]);
    expect(d.evolucao).toHaveLength(30);
  });
});

describe('onboarding: "Onde fica seu dinheiro?"', () => {
  const UUID = /^[0-9a-f-]{36}$/;
  it('ignora linhas sem nome, converte centavos e infere o tipo', () => {
    expect(montarCarteirasOnboarding([
      { nome: ' Nubank ', digitos: '65000' }, { nome: '', digitos: '100' }, { nome: 'Carteira', digitos: '' }, { nome: 'Poupança', digitos: '1' },
    ])).toEqual([
      { id: expect.stringMatching(UUID), indice: 0, carteira: { nome: 'Nubank', tipo: 'banco', saldo_inicial: 650, ordem: 0 } },
      { id: expect.stringMatching(UUID), indice: 2, carteira: { nome: 'Carteira', tipo: 'dinheiro', saldo_inicial: 0, ordem: 2 } },
      { id: expect.stringMatching(UUID), indice: 3, carteira: { nome: 'Poupança', tipo: 'poupanca', saldo_inicial: 0.01, ordem: 3 } },
    ]);
  });
});

it('payload preserva sinal colado e chave estável após reordenação', () => {
  const banco = { id: 'estavel', nome: 'Nu', digitos: '-10000' };
  expect(montarCarteirasOnboarding([{ id: 'outro', nome: 'Caixa', digitos: '50' }, banco])[1]).toMatchObject({ id: 'estavel', carteira: { saldo_inicial: -100, ordem: 1 } });
  expect(montarCarteirasOnboarding([banco])[0]).toMatchObject({ id: 'estavel', carteira: { saldo_inicial: -100, ordem: 0 } });
});
