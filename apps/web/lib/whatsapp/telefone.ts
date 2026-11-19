/**
 * Número (só dígitos) de quem mandou. O WAHA manda `from` como `5511…@c.us`; contas novas podem vir
 * como `…@lid` (id interno), e aí o número real aparece em campos alternativos do `_data`.
 */
export function telefoneDoPayload(payload: Record<string, unknown>): string | null {
  const data = (payload._data ?? {}) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;
  const info = (data.Info ?? data.info ?? {}) as Record<string, unknown>;
  const candidatos = [payload.from, payload.participant, key.remoteJidAlt, key.senderPn, key.participantAlt, info.SenderAlt, info.Sender, info.Chat];
  for (const c of candidatos) {
    if (typeof c !== 'string') continue;
    const m = /^(\d{10,15})(?::\d+)?@(?:c\.us|s\.whatsapp\.net)$/.exec(c);
    if (m) return m[1]!;
  }
  return null;
}

/** Celular BR com e sem o 9 (o WhatsApp ainda manda contas antigas sem ele). */
export function variantesTelefone(numero: string): string[] {
  const com9 = /^(55\d{2})9(\d{8})$/.exec(numero);
  if (com9) return [numero, `${com9[1]}${com9[2]}`];
  const sem9 = /^(55\d{2})([6-9]\d{7})$/.exec(numero);
  if (sem9) return [numero, `${sem9[1]}9${sem9[2]}`];
  return [numero];
}

/** `WHATSAPP_NUMEROS_PERMITIDOS="5511988887777,5521…"`. Vazia = ninguém escreve. */
export function numeroPermitido(numero: string, lista: string | undefined): boolean {
  const permitidos = new Set((lista ?? '').split(/[,;\n]+/).map((n) => n.replace(/\D/g, '')).filter(Boolean));
  return variantesTelefone(numero).some((v) => permitidos.has(v));
}
