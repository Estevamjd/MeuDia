import { AppError } from '@meudia/shared';

/**
 * Coluna/tabela/função que o código novo pede e o banco não tem: a migração 006 não foi aplicada
 * (ver "Ordem de deploy" no README). 42703/42P01/42883 vêm do Postgres; PGRST204/205/202 do schema cache do PostgREST.
 */
const CODIGOS_SCHEMA = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205']);

export const MENSAGEM_SCHEMA_DESATUALIZADO = 'O MeuDia está terminando uma atualização. Tente de novo em alguns minutos.';

export function schemaDesatualizado(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && CODIGOS_SCHEMA.has(error.code);
}

/** Erro de banco → AppError; schema sem a 006 vira SCHEMA_DESATUALIZADO (503) com mensagem amigável. */
export function erroDb(error: { message: string; code?: string }): never {
  if (schemaDesatualizado(error)) {
    throw new AppError(`Schema desatualizado (${error.code}): ${error.message}`, 'SCHEMA_DESATUALIZADO', 503, MENSAGEM_SCHEMA_DESATUALIZADO);
  }
  throw new AppError(error.message, 'DB_ERROR', 500);
}
