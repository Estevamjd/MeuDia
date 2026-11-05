// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Exercicio, SerieRealizada } from '@meudia/shared';
import { ExercicioCaderno } from '../ExercicioCaderno';
import { SeletorDias } from '../SeletorDias';
import { LembreteTreino } from '../LembreteTreino';

afterEach(cleanup);

const supino: Exercicio = {
  id: 'e1', treino_id: 't1', nome: 'Supino reto', series: 3, repeticoes: '8–12', repeticoes_min: 8, repeticoes_max: 12,
  carga: null, tempo_descanso: 90, observacao: null, ordem: 0,
};
const anterior = (n: number, carga: number, reps: number): SerieRealizada => ({
  id: `a${n}`, sessao_id: 'velha', exercicio_id: 'e1', numero_serie: n, carga_usada: carga, reps_feitas: reps, concluido: true,
});

function montar(props: Partial<Parameters<typeof ExercicioCaderno>[0]> = {}) {
  const onMarcar = vi.fn();
  render(
    <ExercicioCaderno
      exercicio={supino}
      posicao={1}
      total={6}
      anteriores={[anterior(1, 60, 10), anterior(2, 60, 9), anterior(3, 57.5, 8)]}
      feitas={[]}
      aberto
      onAlternar={vi.fn()}
      onMarcar={onMarcar}
      onEditar={vi.fn()}
      onExcluir={vi.fn()}
      {...props}
    />,
  );
  return { onMarcar };
}

describe('ExercicioCaderno (tabela SÉRIE · ANTERIOR · KG · REPS · ✓)', () => {
  it('cabeçalho, posição e prescrição com a faixa', () => {
    montar();
    expect(screen.getByText('01 / 06')).toBeTruthy();
    expect(screen.getByText('3 × 8–12')).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Série', 'Anterior', 'Kg', 'Reps', '✓Feita']);
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('tocar em ANTERIOR copia carga e repetições para a série', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar série anterior 3: 57,5 × 8' }));
    expect((screen.getByLabelText('Kg da série 3') as HTMLInputElement).value).toBe('57,5');
    expect((screen.getByLabelText('Repetições da série 3') as HTMLInputElement).value).toBe('8');
    expect((screen.getByLabelText('Kg da série 1') as HTMLInputElement).value).toBe('');
  });

  it('exercício novo mostra "—" e nada para copiar', () => {
    montar({ anteriores: undefined });
    expect(screen.queryByRole('button', { name: /Copiar série anterior/ })).toBeNull();
    expect(screen.getAllByLabelText('Sem registro anterior')).toHaveLength(3);
  });

  it('✓ envia a série com kg decimal (vírgula) e reps', () => {
    const { onMarcar } = montar();
    fireEvent.change(screen.getByLabelText('Kg da série 2'), { target: { value: '62,5' } });
    fireEvent.change(screen.getByLabelText('Repetições da série 2'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Série 2 feita' }));
    expect(onMarcar).toHaveBeenCalledWith({ exercicio_id: 'e1', numero_serie: 2, carga_usada: 62.5, reps_feitas: 9, concluido: true, id: undefined });
  });

  it('série já gravada aparece marcada; tocar de novo desmarca pelo id', () => {
    const feita = { ...anterior(1, 60, 10), id: 'f1', sessao_id: 'atual' };
    const { onMarcar } = montar({ feitas: [feita] });
    const caixa = screen.getByRole('checkbox', { name: 'Série 1 feita' });
    expect(caixa.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(caixa);
    expect(onMarcar).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', concluido: false, carga_usada: 60, reps_feitas: 10 }));
  });

  it('"+ série" acrescenta uma linha', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: '+ série' }));
    expect(screen.getByLabelText('Kg da série 4')).toBeTruthy();
  });

  it('prancha (sem repetição): "3 séries"; fechado mostra o resumo da última vez', () => {
    montar({ exercicio: { ...supino, nome: 'Prancha', repeticoes: '', repeticoes_min: null, repeticoes_max: null }, aberto: false });
    expect(screen.getByText('3 séries')).toBeTruthy();
    expect(screen.getByText('últ. 60 × 10, 60 × 9, 57,5 × 8')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('SeletorDias', () => {
  const dias = [1, 2, 3, 4, 5, 6, 0].map((d, i) => ({
    diaSemana: d, letra: 'STQQSSD'[i]!, nome: `dia ${d}`, descanso: d === 3, treino: d === 1 ? 'Superior A' : null,
  }));

  it('segunda primeiro, quarta riscada, dia ativo com aria-pressed', () => {
    const onSelecionar = vi.fn();
    render(<SeletorDias dias={dias} selecionado={1} hoje={1} onSelecionar={onSelecionar} />);
    const botoes = screen.getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    expect(botoes[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(botoes[2]!.className).toContain('line-through');
    expect(botoes[2]!.getAttribute('aria-label')).toBe('dia 3, recuperação');
    fireEvent.click(botoes[2]!);
    expect(onSelecionar).toHaveBeenCalledWith(3);
  });
});

describe('LembreteTreino', () => {
  it('desligado por padrão e liga ao tocar', () => {
    const onAlterar = vi.fn();
    render(<LembreteTreino ligado={false} salvando={false} onAlterar={onAlterar} />);
    const chave = screen.getByRole('switch', { name: 'Lembrete de treino' });
    expect(chave.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(chave);
    expect(onAlterar).toHaveBeenCalledWith(true);
  });

  it('sem a coluna no banco (null): desligado, desabilitado e com aviso', () => {
    render(<LembreteTreino ligado={null} salvando={false} onAlterar={vi.fn()} />);
    const chave = screen.getByRole('switch') as HTMLButtonElement;
    expect(chave.disabled).toBe(true);
    expect(chave.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Disponível depois da próxima atualização do app.')).toBeTruthy();
  });
});
