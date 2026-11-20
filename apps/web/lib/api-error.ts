import { sanitizarErroParaSentry } from './sentry-scrub';
import * as Sentry from '@sentry/nextjs';
import { AppError } from '@meudia/shared';
import { ZodError } from 'zod';
import { NextResponse } from 'next/server';

export function apiError(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ code: 'VALIDATION_ERROR', error: 'Dados inválidos' }, { status: 400 });
  const status = error instanceof AppError ? error.status ?? 500 : 500;
  if (status >= 500) {
    Sentry.captureException(sanitizarErroParaSentry(error));
  }
  if (error instanceof AppError) return NextResponse.json({ code: error.code, error: error.status && error.status < 500 ? error.message : 'Falha no servidor' }, { status: error.status ?? 500 });
  return NextResponse.json({ code: 'INTERNAL_ERROR', error: 'Falha no servidor' }, { status: 500 });
}
