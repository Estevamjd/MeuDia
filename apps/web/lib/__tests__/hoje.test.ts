import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { anoMesSP, dataCivilSP, diaSemanaDe, diaSemanaSP, hojeSP, ultimosDiasSP } from '../hoje';
import { hojeLocal } from '../../hooks/useSaude';

/**
 * "Hoje" no front = dia de São Paulo. 22:30 de quinta 19/11/2026 em BRT = 01:30 UTC de sexta 20/11:
 * `toISOString().split('T')[0]` dava sexta (o chat dizia que o treino de hoje não foi feito, a dieta abria o dia
 * seguinte) e `format(new Date(), 'yyyy-MM-dd')` dependia do fuso do aparelho.
 */
const TZ_ORIGINAL = process.env.TZ;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T01:30:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = TZ_ORIGINAL;
});

describe('hoje em SP às 22:30 BRT (01:30 UTC do dia seguinte)', () => {
  it('hojeSP e o dia da semana são quinta 19/11, em qualquer fuso do aparelho', () => {
    for (const tz of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      expect(hojeSP()).toBe('2026-11-19');
      expect(diaSemanaSP()).toBe(4);
      expect(hojeLocal()).toBe('2026-11-19');
    }
  });

  it('diaSemanaDe não depende do fuso (0 = domingo, como treinos.dia_semana)', () => {
    process.env.TZ = 'Pacific/Kiritimati';
    expect(diaSemanaDe('2026-11-22')).toBe(0);
    expect(diaSemanaDe('2026-11-16')).toBe(1);
  });
});

describe('datas civis de SP para telas (dataCivilSP, anoMesSP, ultimosDiasSP)', () => {
  it.each(['UTC', 'Asia/Tokyo', 'America/Sao_Paulo'])('aparelho em %s: hoje = quinta 19/11', (tz) => {
    process.env.TZ = tz;
    const d = dataCivilSP();
    expect(format(d, 'yyyy-MM-dd')).toBe('2026-11-19');
    expect(d.getDay()).toBe(4);
    expect(anoMesSP()).toEqual({ ano: 2026, mes: 11 });
    expect(ultimosDiasSP(3).map((x) => [x.iso, x.diaSemana, x.diaDoMes])).toEqual([
      ['2026-11-17', 2, '17'], ['2026-11-18', 3, '18'], ['2026-11-19', 4, '19'],
    ]);
  });

  it('virada do mês: 22:30 de 30/11 em SP (01:30 UTC de 01/12) ainda é novembro', () => {
    process.env.TZ = 'UTC';
    const agora = new Date('2026-12-01T01:30:00Z');
    expect(anoMesSP(agora)).toEqual({ ano: 2026, mes: 11 });
    expect(format(dataCivilSP(agora), 'yyyy-MM-dd')).toBe('2026-11-30');
  });
});

const raiz = path.resolve(__dirname, '../..');
function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) return ['node_modules', '__tests__', '.next', 'e2e'].includes(nome) ? [] : fontes(p);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [p] : [];
  });
}

describe('varredura: nenhum "hoje" em UTC ou no fuso do aparelho no front', () => {
  const arquivos = ['app', 'components', 'hooks', 'lib'].flatMap((d) => fontes(path.join(raiz, d)));
  const PROIBIDOS: [string, RegExp][] = [
    ["toISOString().split('T')[0] de agora", /\b(new Date\(\)|now|agora|hoje)\.toISOString\(\)\.split\(['"]T['"]\)\[0\]/],
    ['toISOString().slice(0, 10) de agora', /\b(new Date\(\)|now|agora|hoje)\.toISOString\(\)\.(slice|substring)\(0,\s*10\)/],
    ["format(agora, 'yyyy-MM-dd')", /format\(\s*(new Date\(\)|now|agora|hoje)\s*,\s*['"]yyyy-MM-dd['"]\s*\)/],
    ['getDay() de agora', /\bgetDay\(\s*new Date\(\)\s*\)|\b(now|hoje|agora)\.getDay\(\)/],
    // Review Codex 5: cabeçalho, botão Hoje, histórico e mês a partir do instante do aparelho.
    ['format(new Date(), …) em tela (use dataCivilSP() ou parseISO(hojeSP()))', /format\(\s*new Date\(\)\s*,/],
    ['addDays/subDays de agora (use somarDias/ultimosDiasSP)', /\b(add|sub)Days\(\s*(new Date\(\)|now|hoje|agora)\s*,/],
    ['mês/ano/dia de agora (use anoMesSP)', /\b(now|hoje|agora)\.(getMonth|getFullYear|getDate)\(\)/],
    ['setSelectedDate(new Date()) (use dataCivilSP())', /setSelectedDate\(\s*new Date\(\)\s*\)/],
  ];

  it('acha os arquivos (a varredura não está vazia)', () => {
    expect(arquivos.length).toBeGreaterThan(100);
  });

  it.each(PROIBIDOS)('sem %s', (_nome, re) => {
    const achados = arquivos.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => path.relative(raiz, f));
    expect(achados).toEqual([]);
  });
});
