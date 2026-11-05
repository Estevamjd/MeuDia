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
