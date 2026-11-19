import 'server-only';
import { candidatoDoRpc, escolherLembrete, relogioSP, type Lembrete } from './lembretes';
import { escreverLembrete } from './lembretes-texto';
import { buscarCandidatos, digitando, marcarLembrete, reservarLembrete, responder, statusSessao } from './servicos';

/**
 * Uma rodada do agendador (o n8n chama a cada 15 min). Segurança, nesta ordem:
 * interruptor global → sessão do WAHA conectada → candidatos (conta ligada, escreveu nos últimos 14 dias, opt-in)
 * → no máximo 1 lembrete por pessoa por rodada → reserva no banco (teto 2/dia, chave única) → "digitando…" →
 * envio → log. Fila global lenta (pausa aleatória entre pessoas) e para tudo na primeira falha de envio.
 */
export const MAX_POR_RODADA = 10;

export interface OpcoesRodada {
  dry: boolean;
  agora?: Date;
  usarIA?: boolean;
}

export interface DepsRodada {
  candidatos?: typeof buscarCandidatos;
  reservar?: typeof reservarLembrete;
  marcar?: typeof marcarLembrete;
  enviar?: typeof responder;
  digitar?: typeof digitando;
  sessao?: typeof statusSessao;
  escrever?: typeof escreverLembrete;
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
}

export type ResultadoRodada =
  | { ok: true; desligado: true }
  | { ok: true; sessao: string; planejados: number; enviados: number; itens?: { telefone: string; tipo: Lembrete['tipo']; texto?: string; status: string }[] }
  | { ok: false; erro: string };

export const mascarar = (tel: string) => `••••${tel.slice(-4)}`;

export async function rodarLembretes(op: OpcoesRodada, deps: DepsRodada = {}): Promise<ResultadoRodada> {
  const {
    candidatos = buscarCandidatos, reservar = reservarLembrete, marcar = marcarLembrete, enviar = responder,
    digitar = digitando, sessao = statusSessao, escrever = escreverLembrete,
    esperar = (ms) => new Promise((r) => setTimeout(r, ms)), aleatorio = Math.random,
  } = deps;
  const agora = op.agora ?? new Date();
  if (!op.dry && process.env.WHATSAPP_LEMBRETES_ATIVOS !== 'true') return { ok: true, desligado: true };

  const status = op.dry ? 'DRY_RUN' : await sessao();
  const r = await candidatos(op.dry && op.agora ? agora : null);
  if (!r.ok) return { ok: false, erro: r.erro ?? 'rpc' };
  const { dia } = relogioSP(agora);
  const plano = (r.candidatos ?? [])
    .map(candidatoDoRpc)
    .map((c) => ({ c, l: escolherLembrete(c, agora) }))
    .filter((x): x is { c: typeof x.c; l: Lembrete } => x.l !== null)
    .sort(() => aleatorio() - 0.5)
    .slice(0, MAX_POR_RODADA);

  if (op.dry) {
    const itens = [];
    for (const { c, l } of plano) itens.push({ telefone: mascarar(c.telefone), tipo: l.tipo, texto: await escrever(c, l, dia, op.usarIA === true), status: 'dry_run' });
    return { ok: true, sessao: status, planejados: plano.length, enviados: 0, itens };
  }
  // Sem sessão conectada (ainda sem chip/QR), não reserva nem envia nada.
  if (status !== 'WORKING') return { ok: true, sessao: status, planejados: plano.length, enviados: 0 };

  const itens: { telefone: string; tipo: Lembrete['tipo']; status: string }[] = [];
  let enviados = 0;
  for (const [n, { c, l }] of plano.entries()) {
    if (n > 0) await esperar(8000 + Math.floor(aleatorio() * 12000)); // fila global: 8–20 s entre pessoas
    const reserva = await reservar(c.telefone, l.tipo, l.chave);
    if (!reserva.ok || !reserva.id) {
      itens.push({ telefone: mascarar(c.telefone), tipo: l.tipo, status: `pulado:${reserva.erro ?? 'reserva'}` });
      continue;
    }
    const texto = await escrever(c, l, dia, true);
    const chatId = `${c.telefone}@c.us`;
    await digitar(chatId, true);
    await esperar(1500 + Math.min(4000, texto.length * 40) + Math.floor(aleatorio() * 1500));
    await digitar(chatId, false);
    const ok = await enviar(chatId, texto);
    await marcar(reserva.id, ok ? 'enviado' : 'falhou');
    // eslint-disable-next-line no-console -- log de cada envio proativo (sem texto e com número mascarado).
    console.info(`[whatsapp/lembrete] tipo=${l.tipo} tel=${mascarar(c.telefone)} status=${ok ? 'enviado' : 'falhou'}`);
    itens.push({ telefone: mascarar(c.telefone), tipo: l.tipo, status: ok ? 'enviado' : 'falhou' });
    if (!ok) break; // disjuntor: na primeira falha, para a rodada (evita martelar o WhatsApp)
    enviados++;
  }
  return { ok: true, sessao: status, planejados: plano.length, enviados, itens };
}
