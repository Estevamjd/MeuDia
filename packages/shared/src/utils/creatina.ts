/**
 * Creatina do dia sem dobra (BRIEF §3.5, PLANO-F1 §3.3). Cada registro de suplemento entra uma vez só,
 * mesmo que apareça de novo pela refeição a que está ligado (a vitamina com Profit aponta para o registro,
 * não soma creatina por conta própria). `creatina_g` null = rótulo ainda vazio: o total pode estar incompleto.
 * Ainda sem tela nem tabela (009): a UI de suplementos entra quando a migration for aplicada.
 */

export interface RegistroCreatina {
  id: string;
  doses: number;
  /** g de creatina por dose, copiado do rótulo na hora do registro; null = desconhecido. */
  creatina_g: number | null;
}

export interface CreatinaDoDia {
  totalG: number;
  /** Algum registro com creatina desconhecida (ex.: Profit com o rótulo vazio). */
  incompleto: boolean;
}

export function creatinaDoDia(registros: readonly RegistroCreatina[]): CreatinaDoDia {
  const vistos = new Set<string>();
  let total = 0;
  let incompleto = false;
  for (const r of registros) {
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    if (r.creatina_g === null || !Number.isFinite(r.creatina_g)) {
      incompleto = true;
      continue;
    }
    total += r.creatina_g * (Number.isFinite(r.doses) ? r.doses : 1);
  }
  return { totalG: Math.round(total * 100) / 100, incompleto };
}
