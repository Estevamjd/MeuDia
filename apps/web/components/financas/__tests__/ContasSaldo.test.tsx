// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PainelSaldo } from '@meudia/api';
import type { Carteira, Previsao } from '@meudia/shared';
import { CategoriaIcone } from '../CategoriaIcone';
import { SeletorCategoria } from '../SeletorCategoria';
import { SeletorCarteira } from '../SeletorCarteira';
import { CardSaldoHoje } from '../home/CardSaldoHoje';
import { CardPrevisao } from '../home/CardPrevisao';
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
    expect(texto()).toContain('Você tem hoje');
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

describe('CardPrevisao', () => {
  const previsao: Previsao = {
    alvoISO: '2026-10-24', saldoHoje: 800, valor: 680,
    itens: [{ tipo: 'conta', id: 'luz', descricao: 'Luz', categoria: 'Luz', valor: -120, data: '2026-10-20', competencia: '2026-10', vencida: false }],
  };
  it('"por quê?" abre a conta em português', () => {
    render(<CardPrevisao tipo="7dias" previsao={previsao} escondido={false} />);
    expect(texto()).toContain('Em 7 dias você terá');
    expect(texto()).toContain('até 24/10');
    expect(texto()).not.toContain('Luz');
    const botao = screen.getByRole('button', { name: /por quê\? Em 7 dias/ });
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(texto()).toContain('Você tem hojeR$ 800,00');
    expect(texto()).toContain('− Luz (vence 20/10)−R$ 120,00');
    expect(texto()).toContain('= Em 24/10R$ 680,00');
  });
  it('negativo: vermelho e "Faltam"', () => {
    render(<CardPrevisao tipo="fimMes" previsao={{ ...previsao, valor: -50 }} escondido={false} />);
    expect(texto()).toContain('No fim do mês sobra');
    expect(screen.getByTestId('previsao-fim-mes-valor').className).toContain('text-red');
    expect(texto()).toContain('Faltam R$ 50,00');
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
  const previsao: Previsao = { alvoISO: '2026-10-24', saldoHoje: 775, valor: 1555, itens: [] };
  const painel = {
    hojeISO: '2026-10-17', competencia: '2026-10', saldoHoje: 775, comecouMes: null,
    carteiras: [{ carteira: carteira('n', 'Nubank'), saldo: 675 }, { carteira: carteira('c', 'Caixa'), saldo: 100 }],
    arquivadas: [], previsao7: previsao, previsaoFim: { ...previsao, valor: 1455 },
    rendasAReceber: [{ renda: { id: 'r', descricao: 'Salário', valor: 900 }, competencia: '2026-10', data: '2026-10-05' }],
    carteiraPadraoId: 'n', transacoesCarteiras: [], transferencias: [],
  } as unknown as PainelSaldo;
  const gasto = { id: 't', user_id: 'u', tipo: 'despesa' as const, categoria: 'Comida', descricao: 'x', valor: 25, data: '2026-10-17', banco: null, automatico: false, created_at: '2026-10-17T15:10:00Z', carteira_id: 'n', ajuste: false };

  it('mês corrente: chips, previsões, renda a receber, rosca e evolução', () => {
    const d = montarDashboard('2026-10', '2026-10-17', painel, [gasto]);
    expect(d.saldo.carteiras.map((c) => [c.nome, c.saldo])).toEqual([['Nubank', 675], ['Caixa', 100]]);
    expect(d.saldo.nomeMes).toBe('outubro');
    expect([d.previsao7?.valor, d.previsaoFim?.valor]).toEqual([1555, 1455]);
    expect(d.rendasAReceber).toEqual([{ rendaId: 'r', descricao: 'Salário', valor: 900, data: '2026-10-05', competencia: '2026-10' }]);
    expect(d.fatias).toEqual([{ categoria: 'Comida', valor: 25 }]);
    expect(d.evolucao).toHaveLength(17);
    expect(d.evolucao.at(-1)).toMatchObject({ dia: 17, gasto: 25 });
  });
  it('outro mês: sem previsões nem Recebi', () => {
    const d = montarDashboard('2026-09', '2026-10-17', painel, []);
    expect(d.previsao7).toBeNull();
    expect(d.rendasAReceber).toEqual([]);
    expect(d.evolucao).toHaveLength(30);
  });
});

describe('onboarding: "Onde fica seu dinheiro?"', () => {
  it('ignora linhas sem nome, converte centavos e infere o tipo', () => {
    expect(montarCarteirasOnboarding([
      { nome: ' Nubank ', digitos: '65000' }, { nome: '', digitos: '100' }, { nome: 'Carteira', digitos: '' }, { nome: 'Poupança', digitos: '1' },
    ])).toEqual([
      { id: '0', indice: 0, carteira: { nome: 'Nubank', tipo: 'banco', saldo_inicial: 650, ordem: 0 } },
      { id: '2', indice: 2, carteira: { nome: 'Carteira', tipo: 'dinheiro', saldo_inicial: 0, ordem: 2 } },
      { id: '3', indice: 3, carteira: { nome: 'Poupança', tipo: 'poupanca', saldo_inicial: 0.01, ordem: 3 } },
    ]);
  });
});

it('payload preserva sinal colado e chave estável após reordenação', () => {
  const banco = { id: 'estavel', nome: 'Nu', digitos: '-10000' };
  expect(montarCarteirasOnboarding([{ id: 'outro', nome: 'Caixa', digitos: '50' }, banco])[1]).toMatchObject({ id: 'estavel', carteira: { saldo_inicial: -100, ordem: 1 } });
  expect(montarCarteirasOnboarding([banco])[0]).toMatchObject({ id: 'estavel', carteira: { saldo_inicial: -100, ordem: 0 } });
});
