import { beforeEach, expect, it, vi } from 'vitest';
import { AppError } from '@meudia/shared';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { apiError } from '../api-error';
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it.each([new AppError('negado', 'UNAUTHORIZED', 401), new AppError('ausente', 'NOT_FOUND', 404), new SyntaxError('json'), z.object({ x: z.string() }).safeParse({}).error])('não reporta 4xx', (error) => {
  expect(apiError(error).status).toBeLessThan(500);
  expect(Sentry.captureException).not.toHaveBeenCalled();
});
it.each([new Error('email pessoa@example.com token=segredo'), new AppError('body secreto', 'DB_ERROR'), { token: 'segredo' }])('reporta 5xx sem propriedades ou mensagens sensíveis', async (error) => {
  const response = apiError(error);
  expect(response.status).toBe(500);
  const captured = vi.mocked(Sentry.captureException).mock.calls[0]![0] as Error;
  expect(captured).toBeInstanceOf(Error);
  expect(captured.message).toBe('Falha no servidor');
  expect(`${captured.stack} ${JSON.stringify(captured)}`).not.toMatch(/pessoa@|segredo|body secreto/);
});
it('conserva frames estruturais mas descarta mensagem, propriedades e URLs com tokens', () => {
  const error = Object.assign(new Error('nome de pessoa'), { body: 'PII', cause: new Error('token') });
  error.stack = 'Error: nome de pessoa\n    at handler (/app/route.ts:10:2)\n    at fetch (https://host/?token=segredo:1:2)';
  apiError(error);
  const captured = vi.mocked(Sentry.captureException).mock.calls[0]![0] as Error;
  expect(captured.stack).toContain('at handler (/app/route.ts:10:2)');
  expect(captured.stack).not.toMatch(/nome de pessoa|segredo/);
  expect(captured).not.toHaveProperty('body');
  expect(captured).not.toHaveProperty('cause');
});

it('SDK sem inicialização/DSN é no-op e não quebra a captura', async () => {
  const sdk = await vi.importActual<typeof Sentry>('@sentry/nextjs');
  expect(sdk.getClient()).toBeUndefined();
  expect(() => sdk.captureException(new Error('falha sintética'))).not.toThrow();
});
