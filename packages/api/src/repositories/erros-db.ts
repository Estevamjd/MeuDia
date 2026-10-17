import { AppError, logger } from '@meudia/shared';

/**
 * Coluna/tabela/função que o código novo pede e o banco não tem: a migração 006 não foi aplicada
 * (ver "Ordem de deploy" no README). 42703/42P01/42883 vêm do Postgres; PGRST204/205/202 do schema cache do PostgREST.
 */
const CODIGOS_SCHEMA = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205']);

export const MENSAGEM_SCHEMA_DESATUALIZADO = 'O MeuDia está terminando uma atualização. Tente de novo em alguns minutos.';

export function schemaDesatualizado(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && CODIGOS_SCHEMA.has(error.code);
}

/**
 * Erro de banco → AppError; schema sem a 006 vira SCHEMA_DESATUALIZADO (503) com mensagem amigável.
 * Os mesmos códigos aparecem por bug de código (coluna digitada errado): o código e a mensagem do banco vão para o log
 * (só nomes de objetos do schema, nada do usuário). Remover o mapeamento quando a 006 estiver estável.
 * 55000: lançamento vinculado a Recebi/Paguei (trigger da 006); só muda pelas RPCs desfazer_*.
 */
export function erroDb(error: { message: string; code?: string }): never {
  if (error.code === '55000') {
    throw new AppError(error.message, 'TRANSACAO_VINCULADA', 409, 'Use Desfazer recebimento/pagamento para alterar este lançamento.');
  }
  if (schemaDesatualizado(error)) {
    logger.warn('SCHEMA_DESATUALIZADO: erro de schema do banco', { code: error.code, message: error.message });
    throw new AppError(`Schema desatualizado (${error.code}): ${error.message}`, 'SCHEMA_DESATUALIZADO', 503, MENSAGEM_SCHEMA_DESATUALIZADO);
  }
  throw new AppError(error.message, 'DB_ERROR', 500);
}
