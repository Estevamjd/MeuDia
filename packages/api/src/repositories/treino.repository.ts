import type { Treino, TreinoInsert } from '@meudia/shared';
import { AppError, logger } from '@meudia/shared';
import { schemaDesatualizado } from './erros-db';
import { paraExercicio, type ExercicioRow } from './exercicio.repository';
import { getSupabase } from './supabase';

// Banco real (000_baseline): `treinos` tem `descricao`, não `observacao`; pedir `observacao` dava 400.
// `exercicios(*)` traz `descanso_segundos`/`repeticoes` (C3): cada exercício passa por `paraExercicio`.
// `horario` (hora planejada) vem da 008. Sem ela no banco, cai nas colunas antigas e ignora a hora.
const COLUNAS_BASE = 'id, user_id, nome, dia_semana, tipo, descricao, ordem, created_at';
const colunas = (com008: boolean) => (com008 ? `${COLUNAS_BASE}, horario` : COLUNAS_BASE);

interface TreinoRow {
  id: string;
  user_id: string;
  nome: string;
  dia_semana: Treino['dia_semana'];
  tipo: Treino['tipo'];
  descricao: string | null;
  ordem: number | null;
  horario?: string | null;
  created_at: string;
  exercicios?: ExercicioRow[];
}

export function paraTreino({ descricao, exercicios, ordem, horario, ...resto }: TreinoRow): Treino {
  // O Postgres devolve TIME como "19:30:00"; o app usa "HH:MM".
  const treino: Treino = { ...resto, observacao: descricao ?? null, ordem: ordem ?? 0, horario: horario ? horario.slice(0, 5) : null };
  if (exercicios) {
    treino.exercicios = exercicios.map(paraExercicio).sort((a, b) => a.ordem - b.ordem);
  }
  return treino;
}

function paraRowTreino(data: Partial<TreinoInsert>, com008: boolean): Record<string, unknown> {
  const { observacao, horario, ...resto } = data;
  const row: Record<string, unknown> = observacao === undefined ? resto : { ...resto, descricao: observacao };
  if (com008 && horario !== undefined) row.horario = horario;
  return row;
}

// Depois do primeiro erro de schema, segue sem `horario` (sem repetir o 400 a cada chamada).
let tem008 = true;
/** Só para testes. */
export function __reiniciarDeteccao008Treino(): void {
  tem008 = true;
}

type Resultado = { data: unknown; error: { message: string; code?: string } | null };

async function comFallback<T>(consulta: (com008: boolean) => PromiseLike<Resultado>): Promise<T> {
  if (tem008) {
    const r = await consulta(true);
    if (!r.error) return r.data as T;
    if (!schemaDesatualizado(r.error)) throw new AppError(r.error.message, 'DB_ERROR');
    tem008 = false;
    logger.warn('treinos sem a coluna horario da 008: seguindo sem a hora do plano', { code: r.error.code });
  }
  const r = await consulta(false);
  if (r.error) throw new AppError(r.error.message, 'DB_ERROR');
  return r.data as T;
}

export async function findByUserId(userId: string): Promise<Treino[]> {
  const rows = await comFallback<TreinoRow[]>((com008) =>
    getSupabase()
      .from('treinos')
      .select(`${colunas(com008)}, exercicios(*)`)
      .eq('user_id', userId)
      .order('ordem', { ascending: true }),
  );
  return rows.map(paraTreino);
}

export async function findById(treinoId: string, userId: string): Promise<Treino> {
  const row = await comFallback<TreinoRow>((com008) =>
    getSupabase()
      .from('treinos')
      .select(`${colunas(com008)}, exercicios(*)`)
      .eq('id', treinoId)
      .eq('user_id', userId)
      .single(),
  );
  return paraTreino(row);
}

export async function create(userId: string, data: TreinoInsert): Promise<Treino> {
  const row = await comFallback<TreinoRow>((com008) =>
    getSupabase()
      .from('treinos')
      .insert({ ...paraRowTreino(data, com008), user_id: userId })
      .select(colunas(com008))
      .single(),
  );
  return paraTreino(row);
}

export async function update(treinoId: string, data: Partial<TreinoInsert>, userId: string): Promise<Treino> {
  const row = await comFallback<TreinoRow>((com008) =>
    getSupabase()
      .from('treinos')
      .update(paraRowTreino(data, com008))
      .eq('id', treinoId)
      .eq('user_id', userId)
      .select(colunas(com008))
      .single(),
  );
  return paraTreino(row);
}

export async function remove(treinoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('treinos')
    .delete()
    .eq('id', treinoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
