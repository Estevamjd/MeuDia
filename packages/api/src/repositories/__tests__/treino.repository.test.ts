import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../treino.repository';

/** `treinos` no banco real tem `descricao` (não `observacao`) e os exercícios embutidos vêm com `descanso_segundos` (C3). */
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

// 000_baseline.sql: CREATE TABLE treinos + ADD COLUMN tipo/ordem; 008: horario, modelo_origem.
const COLUNAS_TREINOS = ['id', 'user_id', 'nome', 'dia_semana', 'descricao', 'ativo', 'created_at', 'tipo', 'ordem', 'horario', 'modelo_origem'];

let result: { data: unknown; error: unknown };
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
beforeEach(() => {
  vi.clearAllMocks();
  repo.__reiniciarDeteccao008Treino();
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

const colunasTreino = () =>
  query.select.mock.calls.flatMap((a) => String(a[0]).split(',').map((c) => c.trim())).filter((c) => !c.startsWith('exercicios('));

it('lista treinos com exercícios no formato do app (descanso, faixa e ordem)', async () => {
  result = {
    data: [{
      id: 't', user_id: 'u', nome: 'Superior A', dia_semana: 1, tipo: 'musculacao', descricao: 'peito', ordem: 0, created_at: '',
      exercicios: [
        { id: 'e2', treino_id: 't', nome: 'Remada', series: 3, repeticoes: 8, repeticoes_min: 8, repeticoes_max: 12, carga: null, descanso_segundos: 60, observacao: null, ordem: 1 },
        { id: 'e1', treino_id: 't', nome: 'Supino', series: 3, repeticoes: 10, carga: 60, descanso_segundos: 90, observacao: null, ordem: 0 },
      ],
    }],
    error: null,
  };
  const [t] = await repo.findByUserId('u');
  for (const c of colunasTreino()) expect(COLUNAS_TREINOS).toContain(c);
  expect(t).toMatchObject({ observacao: 'peito' });
  expect(t).not.toHaveProperty('descricao');
  expect(t!.exercicios!.map((e) => [e.nome, e.repeticoes, e.tempo_descanso])).toEqual([['Supino', '10', 90], ['Remada', '8–12', 60]]);
});

it('create/update gravam `descricao`, nunca `observacao`', async () => {
  result = { data: { id: 't', user_id: 'u', nome: 'X', dia_semana: 1, tipo: null, descricao: 'obs', ordem: 0, created_at: '' }, error: null };
  await repo.create('u', { nome: 'X', dia_semana: 1, observacao: 'obs' });
  expect(query.insert).toHaveBeenCalledWith({ nome: 'X', dia_semana: 1, descricao: 'obs', user_id: 'u' });
  await repo.update('t', { nome: 'Y' }, 'u');
  expect(query.update).toHaveBeenCalledWith({ nome: 'Y' });
  for (const c of colunasTreino()) expect(COLUNAS_TREINOS).toContain(c);
});

it('lê e grava a hora do plano (`horario`, 008) como HH:MM', async () => {
  result = { data: { id: 't', user_id: 'u', nome: 'X', dia_semana: 1, tipo: null, descricao: null, ordem: 0, horario: '19:30:00', created_at: '' }, error: null };
  const t = await repo.update('t', { horario: '19:30' }, 'u');
  expect(query.update).toHaveBeenCalledWith({ horario: '19:30' });
  expect(colunasTreino()).toContain('horario');
  expect(t.horario).toBe('19:30');
  await repo.update('t', { horario: null }, 'u');
  expect(query.update).toHaveBeenLastCalledWith({ horario: null });
});

it('sem a 008 no banco: repete sem `horario` e não manda a hora', async () => {
  let chamadas = 0;
  const respostas = [
    { data: null, error: { code: '42703', message: 'column treinos.horario does not exist' } },
    { data: { id: 't', user_id: 'u', nome: 'X', dia_semana: 1, tipo: null, descricao: null, ordem: 0, created_at: '' }, error: null },
  ];
  const q = { ...query, then: (resolve: (v: unknown) => unknown) => Promise.resolve(respostas[Math.min(chamadas++, 1)]).then(resolve) };
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(q) });
  const t = await repo.update('t', { nome: 'X', horario: '07:00' }, 'u');
  expect(query.update).toHaveBeenNthCalledWith(1, { nome: 'X', horario: '07:00' });
  expect(query.update).toHaveBeenNthCalledWith(2, { nome: 'X' });
  expect(String(query.select.mock.calls.at(-1)?.[0])).not.toContain('horario');
  expect(t.horario).toBeNull();
});

it('erro que não é de schema não cai no fallback', async () => {
  result = { data: null, error: { code: '23505', message: 'dup' } };
  await expect(repo.update('t', { nome: 'X' }, 'u')).rejects.toThrow('dup');
  expect(query.update).toHaveBeenCalledTimes(1);
});
