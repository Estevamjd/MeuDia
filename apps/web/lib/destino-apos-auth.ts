'use server';

import { getAppMode, rotaInicial } from './app-mode';

/** Páginas de auth são estáticas; lê o modo no servidor na hora de sair delas. */
export async function destinoAposAuth(): Promise<string> {
  return rotaInicial(getAppMode());
}
