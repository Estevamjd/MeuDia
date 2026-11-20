// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ResumoMes } from '../../resumo/montarResumoMes';
import { PainelView } from '../PainelView';
import type { NumerosPainel } from '../montarPainel';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
afterEach(cleanup);

const t = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/\s/g, ' ');
const resumo = {
  entrou: 943, aReceber: 0, saiu: 679.9, sobra: 263.1, prevista: 139.1, proximaConta: null, renda: 943, pctUsado: 72, situacao: 'no-controle',
  categorias: [{ categoria: 'Educação', valor: 300, pct: 44 }, { categoria: 'Cartão', valor: 220, pct: 32 }],
  quantidade: { total: 7, whatsapp: 2 }, ultimos: [], vazio: false,
} as unknown as ResumoMes;
const numeros: NumerosPainel = {
  recebeu: 943, previsao: false, recebido: 943, faltaReceber: 0, jaGastou: 679.9, faltaPagar: 124, contasAPagar: 2, fixas: 744, extras: 59.9, sobra: 139.1,
  partes: { fixas: 79, extras: 6, sobra: 15 },
};
const acumulado = [{ dia: 1, gasto: 0, previsto: null }, { dia: 2, gasto: 300, previsto: 300 }, { dia: 3, gasto: null, previsto: 424 }];
const meses = [{ competencia: '2026-10', rotulo: 'out', valor: 110, previsao: false }, { competencia: '2026-11', rotulo: 'nov', valor: 139.1, previsao: true }];

describe('PainelView (Relatório → Painel)', () => {
  it('mês corrente: bloco principal com deve sobrar e recebeu / já gastou / falta pagar', () => {
    render(<PainelView nomeMes="novembro" numeros={numeros} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    expect(t('painel-sobra-valor')).toBe('R$ 139,10');
    expect(t('painel-recebeu')).toBe('R$ 943,00');
    expect(t('painel-ja-gastou')).toBe('R$ 679,90');
    expect(t('painel-falta-pagar')).toBe('R$ 124,00');
  });
  it('cada gráfico tem título e frase explicando como ler', () => {
    render(<PainelView nomeMes="novembro" numeros={numeros} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    expect(t('painel-salario')).toContain('Contas fixas');
    expect(t('painel-salario')).toContain('79%');
    expect(t('painel-categorias')).toContain('Cada cor é uma categoria');
    expect(t('painel-categorias')).toContain('Educação');
    expect(t('painel-dia-a-dia')).toContain('A linha verde tracejada é a sua renda');
    expect(t('painel-meses')).toContain('ainda é previsão');
  });
  it('outro mês (sem a conta da sobra): sobrou = entrou − saiu e número de lançamentos; sem pilha do salário', () => {
    render(<PainelView nomeMes="outubro" numeros={null} resumo={resumo} acumulado={[]} meses={[]} escondido={false} />);
    expect(t('painel-sobra-valor')).toBe('R$ 263,10');
    expect(t('painel-lancamentos')).toBe('7');
    expect(screen.queryByTestId('painel-salario')).toBeNull();
    expect(screen.queryByTestId('painel-meses')).toBeNull();
    expect(screen.queryByTestId('painel-dia-a-dia')).toBeNull();
  });
  const celula = (id: string) => (screen.getByTestId(id).parentElement!.textContent ?? '').replace(/\s/g, ' ');
  it('renda toda recebida: "Recebeu" com a renda do mês', () => {
    render(<PainelView nomeMes="novembro" numeros={numeros} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    expect(celula('painel-recebeu')).toBe('RecebeuR$ 943,00renda do mês');
  });
  it('renda prevista sem nenhum "Recebi": nunca "Recebeu", e sim "Renda" (previsão)', () => {
    const previsto = { ...numeros, previsao: true, recebido: 0, faltaReceber: 943 };
    render(<PainelView nomeMes="novembro" numeros={previsto} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    expect(celula('painel-recebeu')).toBe('RendaR$ 943,00previsão');
    expect(celula('painel-recebeu')).not.toContain('Recebeu');
  });
  it('parte recebida: "Recebeu" só o que entrou e quanto falta', () => {
    const parcial = { ...numeros, recebeu: 2000, previsao: true, recebido: 1200, faltaReceber: 800 };
    render(<PainelView nomeMes="novembro" numeros={parcial} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    expect(celula('painel-recebeu')).toBe('RecebeuR$ 1.200,00falta R$ 800,00');
  });
  it('pílula de situação marcada para o contraste AAA (pilula-situacao + data-situacao)', () => {
    render(<PainelView nomeMes="novembro" numeros={numeros} resumo={resumo} acumulado={acumulado} meses={meses} escondido={false} />);
    const pilula = screen.getByTestId('pilula-situacao');
    expect(pilula.className).toContain('pilula-situacao');
    expect(pilula.getAttribute('data-situacao')).toBe('no-controle');
  });
  it('olho fechado esconde os valores', () => {
    render(<PainelView nomeMes="novembro" numeros={numeros} resumo={resumo} acumulado={acumulado} meses={meses} escondido />);
    expect(t('painel-sobra-valor')).toBe('R$ •••••');
    expect(document.body.textContent).not.toMatch(/943,00|300,00/);
  });
});
