// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { Meta, SobraDoMes } from '@meudia/shared';
import { CardResumoDeslizante, RENDA_PATH, type MetaDoCartao } from '../CardResumoDeslizante';
import { FinancasHomeView, type FinancasHomeViewProps, type GuardeiHome } from '../FinancasHomeView';

afterEach(cleanup);

const t = (el: HTMLElement) => (el.textContent ?? '').replace(/\s/g, ' ');

// Lia: renda 943 − contas 744 − extras 59,90 = deve sobrar 139,10 (novembro tem 30 dias).
const sobra: SobraDoMes = {
  competencia: '2026-11', renda: { lancada: 943, aReceber: 0, total: 943 }, rendasAReceber: [], previsao: false,
  contasFixas: [], totalContasFixas: 744, totalContasPagas: 620, gastosExtras: 59.9, despesasLancadas: 679.9, contasAPagar: [], despesas: 803.9, valor: 139.1,
};
const com = (o: Partial<SobraDoMes>): SobraDoMes => ({ ...sobra, ...o });
const conta = () => screen.getByTestId('cartao-pagina-conta');

describe('Cartão 2 "Ritmo": pode gastar por dia', () => {
  it('com folga: Deve sobrar ÷ dias que faltam contando hoje, para baixo em centavos (139,10 ÷ 12 = 11,59)', () => {
    render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" />);
    expect(within(conta()).getByText('Pode gastar por dia')).toBeTruthy();
    expect(within(conta()).queryByText('Disponível por dia')).toBeNull();
    expect(t(within(conta()).getByTestId('cartao-ritmo-dia'))).toBe('R$ 11,59');
    // A conta de verdade, com as mesmas entradas (Deve sobrar e dias contando hoje).
    expect(t(within(conta()).getByTestId('cartao-ritmo-conta'))).toBe('R$ 139,10 que sobram ÷ 12 dias');
    expect(t(within(conta()).getByTestId('cartao-ritmo-dias'))).toBe('12 dias restantes');
    expect(within(conta()).queryByTestId('cartao-ritmo-nota')).toBeNull();
    // A conta curta continua embaixo, com os mesmos testids.
    expect(t(within(conta()).getByTestId('previsao-fim-mes-valor'))).toBe('R$ 139,10');
  });

  it('último dia do mês: tudo o que sobra pode ser gasto hoje', () => {
    render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-30" />);
    expect(t(within(conta()).getByTestId('cartao-ritmo-dia'))).toBe('R$ 139,10');
    expect(t(within(conta()).getByTestId('cartao-ritmo-dias'))).toBe('último dia do mês');
    expect(t(within(conta()).getByTestId('cartao-ritmo-conta'))).toBe('R$ 139,10 que sobram, só para hoje');
  });

  it('sem folga com excedente: R$ 0,00 por dia e quanto passou do que entra', () => {
    render(<CardResumoDeslizante sobra={com({ valor: -80.5 })} cofrinho={0} hojeISO="2026-11-19" />);
    expect(t(within(conta()).getByTestId('cartao-ritmo-dia'))).toBe('R$ 0,00');
    expect(t(within(conta()).getByTestId('cartao-ritmo-nota'))).toBe('Passou R$ 80,50 do que entra');
    // Sem folga não há divisão: a linha é a nota, nunca "÷".
    expect(within(conta()).queryByTestId('cartao-ritmo-conta')).toBeNull();
    expect(t(conta())).not.toContain('÷');
  });

  it('sobra exatamente zero: R$ 0,00 e "Sem folga este mês"', () => {
    render(<CardResumoDeslizante sobra={com({ valor: 0 })} cofrinho={0} hojeISO="2026-11-19" />);
    expect(t(within(conta()).getByTestId('cartao-ritmo-dia'))).toBe('R$ 0,00');
    expect(t(within(conta()).getByTestId('cartao-ritmo-nota'))).toBe('Sem folga este mês');
  });

  it('sem renda no mês: nenhum número por dia, convite para cadastrar a renda (link para Orçamento)', () => {
    render(<CardResumoDeslizante sobra={com({ renda: { lancada: 0, aReceber: 0, total: 0 }, valor: -803.9 })} cofrinho={0} hojeISO="2026-11-19" />);
    expect(within(conta()).queryByTestId('cartao-ritmo-dia')).toBeNull();
    expect(within(conta()).queryByTestId('cartao-ritmo-nota')).toBeNull();
    const link = within(conta()).getByTestId('cartao-ritmo-sem-renda');
    expect(t(link)).toBe('Cadastre sua renda para ver quanto pode gastar por dia');
    expect(link.getAttribute('href')).toBe(RENDA_PATH);
    // No caminho "rolagem" o cartão não recebe toque; o link precisa pedir de volta, e ter 44px.
    expect(link.className).toContain('pointer-events-auto');
    expect(link.className).toContain('min-h-[44px]');
  });

  it('valores ocultos: nem o por dia nem o excedente aparecem', () => {
    const { unmount } = render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" escondido />);
    expect(t(within(conta()).getByTestId('cartao-ritmo-dia'))).not.toMatch(/\d/);
    expect(t(within(conta()).getByTestId('cartao-ritmo-dias'))).toBe('12 dias restantes');
    unmount();
    render(<CardResumoDeslizante sobra={com({ valor: -80.5 })} cofrinho={0} hojeISO="2026-11-19" escondido />);
    expect(t(within(conta()).getByTestId('cartao-ritmo-nota'))).toBe('Passou do que entra');
    expect(t(conta())).not.toMatch(/R\$ \d/);
  });

  it('renda ainda prevista: selo "previsão" na linha do que entra', () => {
    render(<CardResumoDeslizante sobra={com({ previsao: true })} cofrinho={0} hojeISO="2026-11-19" />);
    expect(within(conta()).getByTestId('renda-previsao').textContent).toBe('previsão');
  });
});

const meta: MetaDoCartao = {
  id: 'm1', nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00Z',
};

describe('Cartão 3 "Meta": + Guardei', () => {
  it('só aparece com onGuardei; toca e chama com o id da meta do cartão; área de toque de 44px e toque devolvido ao botão', () => {
    const { unmount } = render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" metas={[meta]} />);
    expect(screen.queryByTestId('cartao-meta-btn-guardei')).toBeNull();
    unmount();
    const onGuardei = vi.fn();
    render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" metas={[meta]} onGuardei={onGuardei} />);
    const botao = within(screen.getByTestId('cartao-pagina-meta')).getByTestId('cartao-meta-btn-guardei');
    expect(botao.getAttribute('aria-label')).toBe('Guardei na meta Celular novo');
    expect(botao.className).toMatch(/min-h-\[44px\]/);
    expect(botao.className).toMatch(/min-w-\[44px\]/);
    expect(botao.className).toContain('pointer-events-auto');
    // Arrasto lateral começado no botão não vira rolagem do maço, mas a página rola na vertical (pan-y, nunca none).
    expect(botao.className).toContain('touch-pan-y');
    expect(botao.className).not.toContain('touch-none');
    fireEvent.click(botao);
    expect(onGuardei).toHaveBeenCalledWith('m1');
  });

  it.each([
    ['rolagem', true],
    ['reserva', false],
  ] as const)('caminho %s do maço: botão com touch-action pan-y (rola a página, não o maço) e toque isolado do trilho', (modo, suporta) => {
    vi.stubGlobal('CSS', { supports: () => suporta });
    try {
      render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" metas={[meta]} onGuardei={() => undefined} />);
      expect(screen.getByTestId('cartao-maco').getAttribute('data-maco')).toBe(modo);
      const botao = screen.getByTestId('cartao-meta-btn-guardei');
      expect(botao.className.split(/\s+/)).toContain('touch-pan-y');
      expect(botao.className).not.toMatch(/touch-(none|pan-x|auto|manipulation)/);
      const trilho = botao.closest('.maco-trilho') as HTMLElement;
      const noTrilho = vi.fn();
      for (const ev of ['pointerdown', 'touchstart']) trilho.addEventListener(ev, noTrilho);
      for (const ev of ['pointerdown', 'touchstart']) botao.dispatchEvent(new Event(ev, { bubbles: true }));
      expect(noTrilho).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('toque/ponteiro no botão não chega ao trilho (segurar o cartão / assumir a rolagem não disparam)', () => {
    render(<CardResumoDeslizante sobra={sobra} cofrinho={0} hojeISO="2026-11-19" metas={[meta]} onGuardei={() => undefined} />);
    const trilho = screen.getByRole('group', { name: '3 de 3: Meta' }).closest('.maco-trilho') as HTMLElement;
    const noTrilho = vi.fn();
    for (const ev of ['pointerdown', 'touchstart', 'touchend']) trilho.addEventListener(ev, noTrilho);
    const botao = screen.getByTestId('cartao-meta-btn-guardei');
    for (const ev of ['pointerdown', 'touchstart', 'touchend']) botao.dispatchEvent(new Event(ev, { bubbles: true }));
    expect(noTrilho).not.toHaveBeenCalled();
    // Controle: o mesmo evento em outro ponto do cartão chega ao trilho.
    screen.getByTestId('cartao-meta-pct').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(noTrilho).toHaveBeenCalledTimes(1);
  });
});

/** Início com o "+ Guardei" ligado a um estado de verdade (o container real é testado em useFinancasHome.test). */
function InicioComGuardei({ onGuardar, onCorrigir }: { onGuardar: (id: string, v: number) => void; onCorrigir: (id: string, v: number) => void }) {
  const metaCompleta = { ...meta, user_id: 'u', updated_at: null } as unknown as Meta;
  const [aberta, setAberta] = useState<string | null>(null);
  const guardei: GuardeiHome = {
    meta: aberta ? metaCompleta : null,
    salvando: false,
    onAbrir: setAberta,
    onClose: () => setAberta(null),
    onGuardar: (v) => { onGuardar(aberta!, v); setAberta(null); },
    onCorrigir: (v) => onCorrigir(aberta!, v),
  };
  const props = {
    estado: 'pronto',
    secoes: { vazio: false, contasAVencer: null },
    hojeISO: '2026-11-19',
    boasVindas: null,
    rendaSheet: { open: false, onClose: () => undefined, salvando: false, onSalvar: () => undefined },
    onPagar: () => undefined,
    onGastei: () => undefined,
    dashboard: {
      sobraMes: sobra, cofrinho: 0, saldo: { carteiras: [{}] }, rendasAReceber: [], escondido: false,
      onAlternarOlho: () => undefined, onRecebi: () => undefined,
      recebiSheet: { renda: null, carteiras: [], carteiraPadrao: null, salvando: false, onClose: () => undefined, onConfirmar: () => undefined },
      fechamentoSheet: { pergunta: null, aberto: false, salvando: false, onClose: () => undefined, onAgoraNao: () => undefined, onGuardar: () => undefined },
    },
    metas: [meta],
    guardei,
  } as unknown as FinancasHomeViewProps;
  return <FinancasHomeView {...props} />;
}

describe('Início: "+ Guardei" abre o FormGuardei da meta no Modal', () => {
  it('abre com a meta do cartão, soma o valor e fecha', () => {
    const onGuardar = vi.fn();
    render(<InicioComGuardei onGuardar={onGuardar} onCorrigir={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('cartao-meta-btn-guardei'));
    const dialogo = screen.getByRole('dialog', { name: 'Guardei' });
    expect(t(dialogo)).toContain('Em Celular novo você já guardou R$ 840,00');
    fireEvent.change(within(dialogo).getByLabelText('Quanto guardou agora'), { target: { value: '5000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(onGuardar).toHaveBeenCalledWith('m1', 50);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Corrigir o total guardado" grava o total absoluto da mesma meta', () => {
    const onCorrigir = vi.fn();
    render(<InicioComGuardei onGuardar={vi.fn()} onCorrigir={onCorrigir} />);
    fireEvent.click(screen.getByTestId('cartao-meta-btn-guardei'));
    const dialogo = screen.getByRole('dialog', { name: 'Guardei' });
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Corrigir o total guardado' }));
    fireEvent.change(within(dialogo).getByLabelText('Total guardado'), { target: { value: '100000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(onCorrigir).toHaveBeenCalledWith('m1', 1000);
  });
});
