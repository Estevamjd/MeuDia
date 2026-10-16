// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ContaPagar, OcorrenciaConta, OrcamentoCategoria, Transacao } from '@meudia/shared';
import { AlertaContas } from '../AlertaContas';
import { BoasVindasFinancas } from '../BoasVindasFinancas';
import { EntradasSaidas } from '../EntradasSaidas';
import { FinancasHomeView, type FinancasHomeViewProps } from '../FinancasHomeView';
import { HeroSobra } from '../HeroSobra';
import { IndicadoresMes } from '../IndicadoresMes';
import { montarHome, type ResumoHome } from '../montarHome';
import { OrcamentoResumo } from '../OrcamentoResumo';
import { ProximasContas } from '../ProximasContas';
import { UltimosLancamentos } from '../UltimosLancamentos';

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
const limite = (categoria: string, valor_planejado: number): OrcamentoCategoria => ({
  id: `o-${categoria}`, user_id: 'u1', categoria, valor_planejado, created_at: null, updated_at: null,
});

const resumo = (over: Partial<ResumoHome> = {}): ResumoHome => ({
  rendaPrevista: 5000, rendaReal: 5000, gastoReal: 2100, gastoPrevisto: 3200, sobraPrevista: 1800, sobraReal: 2900,
  pctComprometida: 0.64, pagasNoPrazo: 1, vsMesAnterior: { gastoReal: { absoluto: -120, percentual: -0.05 } },
  selo: 'No controle', ...over,
});

const ocorrencias = [
  ocorrencia(conta('c1', 'Luz', 180), '2026-10-16', 'pendente'),
  ocorrencia(conta('c2', 'Internet', 99.9), '2026-10-12', 'vencida'),
  ocorrencia(conta('c3', 'Aluguel', 1500), '2026-10-05', 'paga'),
  ocorrencia(conta('c4', 'Academia', 120), '2026-10-25', 'pendente'),
  ocorrencia(conta('c5', 'Streaming', 39.9), '2026-10-28', 'pendente'),
];
const transacoes = Array.from({ length: 7 }, (_, i) =>
  transacao(`t${i}`, `Mercado ${i + 1}`, 50 + i, `2026-10-${String(i + 1).padStart(2, '0')}`),
);

const viewProps = (over: Partial<FinancasHomeViewProps> = {}, dados: Partial<Parameters<typeof montarHome>[0]> = {}): FinancasHomeViewProps => ({
  estado: 'pronto',
  hojeISO: HOJE,
  secoes: montarHome({
    competencia: '2026-10', hojeISO: HOJE, resumo: resumo(), ocorrencias, orcamento: [limite('Alimentação', 500)], transacoes, ...dados,
  }),
  boasVindas: { rendaCadastrada: false, contasCadastradas: false, estadoLembretes: 'inativo', onAtivarLembretes: vi.fn() },
  onPagar: vi.fn(),
  lancamentos: { expandido: false, onAlternarExpandido: vi.fn(), onNovo: vi.fn(), onEditar: vi.fn(), onExcluir: vi.fn() },
  ...over,
});

describe('HeroSobra', () => {
  it('mostra a sobra real, a prevista na sublinha, o selo e o uso da renda', () => {
    render(<HeroSobra sobraReal={2900} sobraPrevista={1800} selo="No controle" gastoReal={2100} rendaBase={5000} />);
    expect(texto()).toContain('Sobra do mês');
    expect(texto()).toContain('R$ 2.900,00');
    expect(texto()).toContain('Prevista: R$ 1.800,00');
    expect(texto()).toContain('No controle');
    expect(texto()).toContain('Você já usou 42% da renda');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
  });

  it('negativo leva "−" e cor vermelha; valor não quebra linha', () => {
    render(<HeroSobra sobraReal={-250} sobraPrevista={100} selo="Apertado" gastoReal={5250} rendaBase={5000} />);
    const valor = screen.getByText((_, el) => el?.tagName === 'P' && texto(el as HTMLElement) === '−R$ 250,00');
    expect(valor.className).toContain('text-red');
    expect(valor.className).toContain('whitespace-nowrap');
    expect(valor.className).toContain('tabular-nums');
    expect(valor.getAttribute('style')).toContain('clamp(1.5rem, 8vw, 2rem)');
  });

  it('gasto acima da renda: aria-valuenow limitado a 100, % real no aria-valuetext', () => {
    render(<HeroSobra sobraReal={-2500} sobraPrevista={100} selo="Apertado" gastoReal={7500} rendaBase={5000} />);
    const barra = screen.getByRole('progressbar');
    expect(barra.getAttribute('aria-valuenow')).toBe('100');
    expect(barra.getAttribute('aria-valuemax')).toBe('100');
    expect(barra.getAttribute('aria-valuetext')).toBe('150% da renda usada');
    expect(texto()).toContain('Você já usou 150% da renda');
  });
});

describe('EntradasSaidas', () => {
  it('um valor por campo: real em destaque e previsto na sublinha; comparativo só se ≠ 0', () => {
    render(
      <EntradasSaidas rendaReal={5000} rendaPrevista={5200} gastoReal={2100} gastoPrevisto={3200}
        comparativoGasto={{ texto: 'R$ 120,00 a menos que em setembro', aumentou: false }} />,
    );
    expect(texto()).toContain('Entrou');
    expect(texto()).toContain('de R$ 5.200,00 previstos');
    expect(texto()).toContain('Saiu');
    expect(texto()).toContain('de R$ 3.200,00 previstos');
    expect(texto()).toContain('a menos que em setembro');
    expect(texto()).not.toContain(' / ');
  });

  it('valores grandes: fonte fluida, sem quebra, cards com min-w-0 (375px)', () => {
    render(<EntradasSaidas rendaReal={100000} rendaPrevista={100000} gastoReal={100000} gastoPrevisto={100000} comparativoGasto={null} />);
    const valores = screen.getAllByText((_, el) => el?.tagName === 'P' && texto(el as HTMLElement) === 'R$ 100.000,00');
    expect(valores).toHaveLength(2);
    for (const v of valores) {
      expect(v.className).toContain('whitespace-nowrap');
      expect(v.className).not.toContain('text-lg');
      expect(v.getAttribute('style')).toContain('clamp(0.95rem, 4.6vw, 1.125rem)');
      expect(v.parentElement?.className).toContain('min-w-0');
    }
  });

  it('sem comparativo quando o gasto não mudou', () => {
    render(<EntradasSaidas rendaReal={0} rendaPrevista={0} gastoReal={0} gastoPrevisto={0} comparativoGasto={null} />);
    expect(texto()).not.toMatch(/mês anterior|a mais|a menos/);
  });
});

describe('AlertaContas', () => {
  it('conta vencendo hoje/vencida com link para marcar como paga', () => {
    render(<AlertaContas contas={[{ id: 'c1', descricao: 'Luz', vencimento: HOJE }, { id: 'c2', descricao: 'Internet', vencimento: '2026-10-12' }]} hojeISO={HOJE} href="#proximas-contas" />);
    expect(screen.getByRole('alert').textContent).toContain('2 contas pedem atenção · Luz vence hoje');
    expect(screen.getByRole('link', { name: 'Ver e marcar como paga' }).getAttribute('href')).toBe('#proximas-contas');
  });

  it('sem contas urgentes não renderiza nada', () => {
    const { container } = render(<AlertaContas contas={[]} hojeISO={HOJE} href="#x" />);
    expect(container.innerHTML).toBe('');
  });
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

describe('OrcamentoResumo', () => {
  it('mostra gasto, limite e quanto resta; vermelho quando estoura', () => {
    render(<OrcamentoResumo categorias={[{ categoria: 'Alimentação', gasto: 320, limite: 500 }, { categoria: 'Lazer', gasto: 250, limite: 200 }]} />);
    expect(texto()).toContain('R$ 320,00 de R$ 500,00');
    expect(texto()).toContain('restam R$ 180,00');
    expect(texto()).toContain('passou R$ 50,00 do limite');
    expect(screen.getByText('passou', { exact: false }).className).toContain('text-red');
    expect(screen.getByRole('link', { name: 'Ver orçamento' }).getAttribute('href')).toBe('/financas/orcamento');
  });

  it('sem categorias com limite não renderiza', () => {
    const { container } = render(<OrcamentoResumo categorias={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('IndicadoresMes', () => {
  it('chips de renda comprometida e pagas em dia', () => {
    render(<IndicadoresMes pctComprometida={0.64} pagasNoPrazo={1} />);
    expect(texto()).toContain('Renda comprometida64%');
    expect(texto()).toContain('Pagas em dia100%');
  });

  it('oculta "Pagas em dia" quando nada venceu', () => {
    render(<IndicadoresMes pctComprometida={0.3} pagasNoPrazo={null} />);
    expect(texto()).not.toContain('Pagas em dia');
  });
});

describe('BoasVindasFinancas', () => {
  it('3 passos com links e botão de lembretes; passo feito vira ✓', () => {
    const onAtivar = vi.fn();
    render(
      <BoasVindasFinancas rendaCadastrada={false} contasCadastradas estadoLembretes="inativo"
        onAtivarLembretes={onAtivar} onNovoLancamento={vi.fn()} />,
    );
    expect(texto()).toContain('Vamos montar seu mês');
    expect(texto()).toContain('Em 3 passos você vê quanto sobra e recebe lembretes das contas.');
    expect(screen.getByRole('link', { name: 'Cadastrar renda' }).getAttribute('href')).toBe('/financas/orcamento');
    expect(screen.queryByRole('link', { name: 'Adicionar conta' })).toBeNull();
    expect(screen.getAllByLabelText('Feito')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ativar lembretes' }));
    expect(onAtivar).toHaveBeenCalled();
  });

  it('iPhone sem PWA instalado: orienta "Adicionar à Tela de Início"', () => {
    render(<BoasVindasFinancas rendaCadastrada={false} contasCadastradas={false} estadoLembretes="requer-instalacao" onAtivarLembretes={vi.fn()} onNovoLancamento={vi.fn()} />);
    expect(texto()).toContain('Adicionar à Tela de Início');
    expect(screen.getByRole('link', { name: 'Adicionar conta' }).getAttribute('href')).toBe('/financas/contas?nova=1');
  });

  it('push indisponível: some o passo de lembretes', () => {
    render(<BoasVindasFinancas rendaCadastrada={false} contasCadastradas={false} estadoLembretes="nao-suportado" onAtivarLembretes={vi.fn()} onNovoLancamento={vi.fn()} />);
    expect(texto()).toContain('Em 2 passos');
    expect(texto()).not.toContain('Ativar lembretes');
  });
});

describe('UltimosLancamentos', () => {
  const props = { expandido: false, onAlternarExpandido: vi.fn(), onNovo: vi.fn(), onEditar: vi.fn(), onExcluir: vi.fn() };

  it('mostra 5 e "Ver todos"; editar/excluir chamam os callbacks', () => {
    const onEditar = vi.fn();
    const onExcluir = vi.fn();
    render(<UltimosLancamentos {...props} onEditar={onEditar} onExcluir={onExcluir} transacoes={transacoes} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Ver todos (7)' })).toBeTruthy();
    expect(texto()).toContain('−R$ 50,00');
    fireEvent.click(screen.getByRole('button', { name: 'Editar lançamento Mercado 1' }));
    expect(onEditar).toHaveBeenCalledWith(transacoes[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento Mercado 2' }));
    expect(onExcluir).toHaveBeenCalledWith(transacoes[1]);
    semTransacaoSemAcento();
  });

  it('vazio: mensagem e botão "Novo lançamento"', () => {
    const onNovo = vi.fn();
    render(<UltimosLancamentos {...props} onNovo={onNovo} transacoes={[]} />);
    expect(texto()).toContain('Nenhum lançamento neste mês.');
    fireEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    expect(onNovo).toHaveBeenCalled();
  });
});

describe('montarHome', () => {
  it('alerta com vencidas e de hoje; próximas = 3 não pagas, vencidas primeiro', () => {
    const s = montarHome({ competencia: '2026-10', hojeISO: HOJE, resumo: resumo(), ocorrencias, orcamento: [], transacoes: [] });
    expect(s.alerta?.contas.map((c) => c.descricao)).toEqual(['Internet', 'Luz']);
    expect(s.proximasContas?.contas.map((c) => c.descricao)).toEqual(['Internet', 'Luz', 'Academia']);
    expect(s.proximasContas?.totalMes).toBe(5);
    expect(s.entradasSaidas.comparativoGasto?.texto.replace(/\s/g, ' ')).toBe('R$ 120,00 a menos que em setembro');
    expect(s.orcamento).toBeNull();
  });

  it('gasto igual ao mês anterior: sem comparativo; sem renda: vazio', () => {
    const s = montarHome({
      competencia: '2026-10', hojeISO: HOJE, ocorrencias: [], orcamento: [], transacoes: [],
      resumo: resumo({ rendaPrevista: 0, rendaReal: 0, vsMesAnterior: { gastoReal: { absoluto: 0, percentual: null } } }),
    });
    expect(s.entradasSaidas.comparativoGasto).toBeNull();
    expect(s.vazio).toBe(true);
    expect(s.alerta).toBeNull();
    expect(s.proximasContas).toBeNull();
  });
});

describe('FinancasHomeView', () => {
  it('com dados: todas as seções, sem "real / previsto" nem "igual ao mês anterior"', () => {
    render(<FinancasHomeView {...viewProps()} />);
    for (const titulo of ['Sobra do mês', 'Entrou', 'Saiu', 'Próximas contas', 'Orçamento', 'Renda comprometida', 'Últimos lançamentos']) {
      expect(texto()).toContain(titulo);
    }
    expect(screen.getByRole('alert').textContent).toContain('2 contas pedem atenção');
    expect(texto()).not.toMatch(/real \/ previst|igual ao mês anterior|Vamos montar seu mês/);
    semTransacaoSemAcento();
  });

  it('"Paguei" na home chama onPagar', () => {
    const onPagar = vi.fn();
    render(<FinancasHomeView {...viewProps({ onPagar })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paguei Internet' }));
    expect(onPagar).toHaveBeenCalledWith(expect.objectContaining({ contaId: 'c2', competencia: '2026-10' }));
  });

  it('usuária nova (vazio): só o card de boas-vindas, sem "R$ 0,00"', () => {
    const props = viewProps({}, {
      resumo: resumo({ rendaPrevista: 0, rendaReal: 0, gastoReal: 0, gastoPrevisto: 0, sobraPrevista: 0, sobraReal: 0, pctComprometida: null, pagasNoPrazo: null, selo: null, vsMesAnterior: { gastoReal: { absoluto: 0, percentual: null } } }),
      ocorrencias: [], orcamento: [], transacoes: [],
    });
    render(<FinancasHomeView {...props} />);
    expect(props.secoes?.vazio).toBe(true);
    expect(texto()).toContain('Vamos montar seu mês');
    expect(texto()).not.toContain('R$');
    expect(texto()).not.toMatch(/Sobra do mês|Próximas contas|Últimos lançamentos|Renda comprometida/);
    fireEvent.click(screen.getByRole('button', { name: 'Ou registre um lançamento agora' }));
    expect(props.lancamentos.onNovo).toHaveBeenCalled();
    semTransacaoSemAcento();
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
