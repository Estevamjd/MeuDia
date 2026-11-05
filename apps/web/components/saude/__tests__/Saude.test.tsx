// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Refeicao } from '@meudia/shared';
import { BarraCalorias, BarraProteina } from '../Barras';
import { LinhaTempo } from '../LinhaTempo';
import { OnboardingSaude } from '../OnboardingSaude';
import { linhasParaItens } from '../EditarRefeicao';
import { linhaDoTempo } from '../../../lib/refeicoes-dia';

afterEach(cleanup);

describe('BarraCalorias', () => {
  it('1.930 / 3.102 = 62%, barra --accent3, sem "meta cumprida"', () => {
    const { container } = render(<BarraCalorias consumido={1930} meta={3102} />);
    expect(screen.getByText('1.930')).toBeTruthy();
    expect(screen.getByText('/ 3.102')).toBeTruthy();
    expect(screen.getByText('62%').className).toContain('text-accent3');
    expect(screen.queryByText('meta cumprida')).toBeNull();
    expect(container.querySelector('[data-barra="ate-meta"]')!.className).toContain('bg-accent3');
    expect(container.querySelector('[data-barra="excedente"]')).toBeNull();
  });

  it('acima de 100% (tela 09): 106% verde, meta cumprida, 198 kcal acima, verde + verde-escuro; nunca vermelho', () => {
    const { container } = render(<BarraCalorias consumido={3300} meta={3102} />);
    expect(screen.getByText('106%').className).toContain('text-green');
    expect(screen.getByText('meta cumprida')).toBeTruthy();
    expect(screen.getByText('198 kcal acima da meta do dia.')).toBeTruthy();
    const ate = container.querySelector<HTMLElement>('[data-barra="ate-meta"]')!;
    const exc = container.querySelector<HTMLElement>('[data-barra="excedente"]')!;
    expect(ate.className).toContain('bg-green');
    expect(exc.className).toContain('bg-green-dark');
    expect(Math.round(parseFloat(ate.style.width))).toBe(94);
    expect(Math.round(parseFloat(exc.style.width))).toBe(6);
    expect(container.innerHTML).not.toMatch(/red|alert/i);
  });

  it('avisa itens sem valor fora do total', () => {
    render(<BarraCalorias consumido={420} meta={3102} itensSemValor={2} />);
    expect(screen.getByText('2 itens sem valor não entram no total.')).toBeTruthy();
  });

  it('proteína: faixa 120–140 e "na faixa" quando dentro', () => {
    render(<BarraProteina consumido={131} min={120} max={140} />);
    expect(screen.getByText('g · faixa 120–140')).toBeTruthy();
    expect(screen.getByText('na faixa')).toBeTruthy();
  });
});

const refeicao = (tipo: Refeicao['tipo'], items: Refeicao['items']): Refeicao => ({
  id: `r-${tipo}`, user_id: 'u', tipo, data: '2026-11-02', items, total_calorias: 0, total_proteina: 0, total_carbo: 0, total_gordura: 0,
});

describe('LinhaTempo (Dieta)', () => {
  const entradas = linhaDoTempo([
    refeicao('cafe', [{ nome: 'pão', calorias: 300, fonte: 'manual' }, { nome: 'ovos', calorias: 312 }]),
    refeicao('jantar', [{ nome: 'Profit 28500', calorias: null }, { nome: 'leite', calorias: null }]),
  ]);

  it('kcal da refeição, "sem valor" em itálico (nunca 0) e selo "fora da TACO"', () => {
    render(<LinhaTempo entradas={entradas} onPonto={vi.fn()} comKcal />);
    expect(screen.getByText('612')).toBeTruthy();
    // Vitamina registrada sem valor + 4 horários pendentes do modelo (itens só com nome).
    const sem = screen.getAllByText('sem valor');
    expect(sem).toHaveLength(5);
    for (const s of sem) expect(s.className).toContain('italic');
    expect(screen.queryByText('0')).toBeNull();
    // Selo só nas 2 registradas; os 4 horários pendentes não têm valor de origem nenhuma.
    expect(screen.getAllByText('fora da TACO').length).toBe(2);
    expect(screen.queryByText('ref. TACO')).toBeNull();
  });

  it('ponto cheio = feita; tocar avisa a entrada', () => {
    const onPonto = vi.fn();
    render(<LinhaTempo entradas={entradas} onPonto={onPonto} />);
    expect(screen.getByRole('checkbox', { name: 'Café da manhã feita' }).getAttribute('aria-checked')).toBe('true');
    const almoco = screen.getByRole('checkbox', { name: 'Almoço feita' });
    expect(almoco.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(almoco);
    expect(onPonto).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'almoco', feita: false }));
  });
});

describe('editor de refeição: campo vazio = sem valor', () => {
  it('kcal vazia vira null, vírgula vira ponto, nome vazio é ignorado', () => {
    expect(linhasParaItens([
      { nome: 'Profit 28500', gramas: '', kcal: '', proteina: '' },
      { nome: 'leite', gramas: '200', kcal: '120', proteina: '6,4' },
      { nome: '  ', gramas: '', kcal: '50', proteina: '' },
    ])).toEqual([
      { nome: 'Profit 28500', quantidade: null, calorias: null, proteina: null, fonte: 'manual' },
      { nome: 'leite', quantidade: 200, calorias: 120, proteina: 6.4, fonte: 'manual' },
    ]);
  });

  it('número inválido e lista vazia dão erro', () => {
    expect(linhasParaItens([{ nome: 'pão', gramas: 'x', kcal: '', proteina: '' }])).toBe('Confira os números de "pão".');
    expect(linhasParaItens([{ nome: '', gramas: '', kcal: '', proteina: '' }])).toBe('Adicione pelo menos um item.');
  });
});

describe('OnboardingSaude (3 telas)', () => {
  const montar = (extra: Partial<Parameters<typeof OnboardingSaude>[0]> = {}) => {
    const onConcluir = vi.fn();
    const onAgoraNao = vi.fn();
    render(<OnboardingSaude inicial={{}} metasAnteriores={null} salvando={false} erro={null} onConcluir={onConcluir} onAgoraNao={onAgoraNao} {...extra} />);
    return { onConcluir, onAgoraNao };
  };
  const preencher = () => {
    fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masculino' }));
    fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '175' } });
    fireEvent.change(screen.getByLabelText('Peso atual'), { target: { value: '70,0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('radio', { name: /Moderado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ganhar peso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver metas' }));
  };

  it('não avança com campo vazio e mostra o motivo', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Sobre você' })).toBeTruthy();
    expect(screen.getByText('Idade entre 15 e 100 anos.')).toBeTruthy();
  });

  it('Rotina mostra os 3 níveis com os fatores 1,40 / 1,70 / 2,00', () => {
    montar({ inicial: { idade: 28, sexo: 'masculino', alturaCm: 175, pesoKg: 70 } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Leve · pouco movimento no dia · ×1,40',
      'Moderado · treino regular e dia ativo · ×1,70',
      'Intenso · trabalho físico ou treino pesado diário · ×2,00',
    ]);
  });

  it('exemplo do design-system: 3.102 kcal (gasto 2.820 + 10%) e 126 g, origem calculada, com o aviso Mifflin', () => {
    const { onConcluir } = montar();
    preencher();
    expect(screen.getByRole('heading', { name: 'Metas' })).toBeTruthy();
    expect(screen.getByText('3.102')).toBeTruthy();
    expect(screen.getByText(/gasto estimado 2\.820 kcal \+ 10% para ganho/)).toBeTruthy();
    expect(screen.getByText('126')).toBeTruthy();
    expect(screen.getAllByText('calculada')).toHaveLength(2);
    expect(screen.getByText(/Estimativa baseada em médias \(fórmula Mifflin-St Jeor\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e começar' }));
    expect(onConcluir).toHaveBeenCalledWith(
      { idade: 28, sexo: 'masculino', alturaCm: 175, pesoKg: 70, nivel: 'moderado', objetivo: 'ganhar' },
      expect.objectContaining({ kcal: 3102, kcalOrigem: 'calculada', proteinaMinG: 126, proteinaOrigem: 'calculada' }),
    );
  });

  it('editar a meta vira "definida por você" e continua assim depois de voltar e mudar a rotina', () => {
    const { onConcluir } = montar();
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Editar calorias / dia' }));
    fireEvent.change(screen.getByLabelText('Calorias / dia'), { target: { value: '2950' } });
    fireEvent.click(screen.getByRole('button', { name: 'salvar' }));
    expect(screen.getByText('2.950')).toBeTruthy();
    expect(screen.getByText('definida por você')).toBeTruthy();
    expect(screen.getByText(/calculada: 3\.102 kcal/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '← voltar' }));
    fireEvent.click(screen.getByRole('radio', { name: /Intenso/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver metas' }));
    expect(screen.getByText('2.950')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e começar' }));
    expect(onConcluir.mock.calls[0]![1]).toMatchObject({ kcal: 2950, kcalOrigem: 'manual', kcalCalculada: 3650 });
  });

  it('proteína fora de 1,4–2,2 g/kg é recusada', () => {
    montar();
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Editar proteína / dia' }));
    fireEvent.change(screen.getByLabelText('Proteína / dia'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'salvar' }));
    expect(screen.getByText('Para 70,0 kg, fica entre 98 e 154 g (1,4 a 2,2 g/kg).')).toBeTruthy();
  });

  it('"Agora não" em qualquer passo; erro de rede aparece e o botão volta', () => {
    const { onAgoraNao } = montar({ erro: 'Não deu para salvar na sua conta.' });
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(onAgoraNao).toHaveBeenCalled();
    preencher();
    expect(within(screen.getByRole('alert')).getByText('Não deu para salvar na sua conta.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Salvar e começar' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
