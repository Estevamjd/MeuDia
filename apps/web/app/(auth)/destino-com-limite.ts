import { destinoAposAuth } from '../../lib/destino-apos-auth';

/** A descoberta do modo não deve bloquear a entrada; cai em /financas (rota inicial dos dois modos). */
export async function destinoComLimite(): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      destinoAposAuth(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve('/financas'), 2500);
      }),
    ]);
  } catch {
    return '/financas';
  } finally {
    clearTimeout(timer);
  }
}
