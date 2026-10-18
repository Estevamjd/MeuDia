// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Meta } from '@meudia/shared';
import { ICONES_META, sugestaoMeta } from '@meudia/shared';
import { MetaCard } from '../MetaCard';
import { FormMeta } from '../FormMeta';
import { FormGuardei } from '../FormGuardei';
import { ICONES_LUCIDE_META } from '../IconeMeta';

afterEach(cleanup);
const texto = () => (document.body.textContent ?? '').replace(/\s/g, ' ');

const meta = (over: Partial<Meta> = {}): Meta => ({
  id: 'm', user_id: 'u', nome: 'Videogame', icone: 'gamepad', valor_alvo: 3000, data_limite: '2027-01-31', valor_guardado: 0,
  criado_em: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z', ...over,
});
const sugestao = (m: Meta, sobra = 2090) =>
  sugestaoMeta({ hojeISO: '2026-10-18', sobraMensal: sobra, valorAlvo: m.valor_alvo, valorGuardado: m.valor_guardado, dataLimite: m.data_limite });

describe('MetaCard', () => {
  it('nome, progresso guardado/alvo, prazo e sugestão do exemplo; Guardei e Excluir', () => {
    const onGuardei = vi.fn();
    const onExcluir = vi.fn();
    const m = meta({ valor_guardado: 500 });
    render(<MetaCard meta={m} sugestao={sugestao(m)} onGuardei={onGuardei} onExcluir={onExcluir} />);
    expect(texto()).toContain('Videogame');
    expect(texto()).toContain('Guardado R$ 500,00 de R$ 3.000,00 · 16%');
    expect(texto()).toContain('Faltam R$ 2.500,00');
    expect(texto()).toContain('até janeiro de 2027');
    const barra = screen.getByRole('progressbar', { name: 'Progresso de Videogame' });
    expect(barra.getAttribute('aria-valuenow')).toBe('16'); // percentual inteiro arredondado para baixo
    expect(texto()).toContain('Guarde R$ 833,34 por mês e em janeiro de 2027 você compra');
    fireEvent.click(screen.getByRole('button', { name: 'Guardei em Videogame' }));
    expect(onGuardei).toHaveBeenCalledWith(m);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir meta Videogame' }));
    expect(onExcluir).toHaveBeenCalledWith(m);
  });
  it('não cabe: aviso + prazos com a sobra inteira e com metade; meta alcançada', () => {
    const m = meta();
    render(<MetaCard meta={m} sugestao={sugestao(m, 600)} onGuardei={vi.fn()} onExcluir={vi.fn()} />);
    expect(texto()).toContain('R$ 1.000,00 por mês não cabe na sua sobra de R$ 600,00');
    expect(texto()).toContain('Guardando metade da sobra (R$ 300,00 por mês): 10 meses, em agosto de 2027.');
    cleanup();
    const ok = meta({ valor_guardado: 3500 });
    render(<MetaCard meta={ok} sugestao={sugestao(m)} onGuardei={vi.fn()} onExcluir={vi.fn()} />);
    expect(texto()).toContain('Meta alcançada 🎉');
    expect(texto()).not.toContain('Faltam');
    expect(texto()).not.toContain('por mês');
    expect(screen.getByRole('progressbar').className).toContain('bg-green');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('FormMeta', () => {
  it('cria com nome, valor (máscara em centavos), data opcional e ícone', () => {
    const onSalvar = vi.fn();
    render(<FormMeta salvando={false} onSalvar={onSalvar} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: ' Videogame ' } });
    fireEvent.change(screen.getByLabelText('Quanto custa'), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText('Até quando (opcional)'), { target: { value: '2027-01-31' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Videogame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(onSalvar).toHaveBeenCalledWith({ nome: 'Videogame', valor_alvo: 3000, data_limite: '2027-01-31', icone: 'gamepad' });
  });
  it('sem nome ou sem valor não salva; sem data manda null', () => {
    const onSalvar = vi.fn();
    render(<FormMeta salvando={false} onSalvar={onSalvar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Informe o nome');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bike' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(onSalvar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Quanto custa'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(onSalvar).toHaveBeenCalledWith({ nome: 'Bike', valor_alvo: 1500, data_limite: null, icone: null });
  });
});

describe('FormGuardei', () => {
  it('soma por padrão; "Corrigir o total guardado" grava o valor absoluto (aceita 0)', () => {
    const onGuardar = vi.fn();
    const onCorrigir = vi.fn();
    render(<FormGuardei meta={meta({ valor_guardado: 500 })} salvando={false} onGuardar={onGuardar} onCorrigir={onCorrigir} />);
    fireEvent.change(screen.getByLabelText('Quanto guardou agora'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onGuardar).toHaveBeenCalledWith(500);
    fireEvent.click(screen.getByRole('radio', { name: 'Corrigir o total guardado' }));
    fireEvent.change(screen.getByLabelText('Total guardado'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onCorrigir).toHaveBeenCalledWith(0);
  });
});

it('todo ícone de meta tem um ícone lucide', () => {
  for (const i of ICONES_META) expect(ICONES_LUCIDE_META[i]).toBeTruthy();
});
