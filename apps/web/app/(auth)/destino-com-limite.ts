import { destinoAposAuth } from '../../lib/destino-apos-auth';

/** A descoberta do modo não deve bloquear a entrada; o middleware resolve /inicio. */
export async function destinoComLimite(): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      destinoAposAuth(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve('/inicio'), 2500);
      }),
    ]);
  } catch {
    return '/inicio';
  } finally {
    clearTimeout(timer);
  }
}
