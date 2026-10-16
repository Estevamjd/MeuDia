import { AppError } from '@meudia/shared';
import { ZodError } from 'zod';
import { NextResponse } from 'next/server';

export function apiError(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ code: 'VALIDATION_ERROR', error: 'Dados inválidos' }, { status: 400 });
  if (error instanceof AppError) return NextResponse.json({ code: error.code, error: error.status && error.status < 500 ? error.message : 'Falha no servidor' }, { status: error.status ?? 500 });
  return NextResponse.json({ code: 'INTERNAL_ERROR', error: 'Falha no servidor' }, { status: 500 });
}
