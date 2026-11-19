import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hojeSP } from '@meudia/shared';
import { horaSP } from '../../components/registros/datas';
import { interpretarComClaude } from './claude';
import { ehEscrita, type Intencao } from './intencao';
import { interpretarPorRegras } from './regras';
import { AJUDA, NAO_ENTENDI, confirmacao, erroRpc } from './respostas';
import { registrarNoBanco, responder } from './servicos';
import { numeroPermitido, telefoneDoPayload } from './telefone';

/** HMAC-SHA512 do corpo cru (`X-Webhook-Hmac`, igual ao WAHA). Comparação em tempo constante. */
export function assinaturaValida(corpo: string, assinatura: string | null, chave: string): boolean {
  if (!assinatura) return false;
  const esperado = Buffer.from(createHmac('sha512', chave).update(corpo).digest('hex'));
  const recebido = Buffer.from(assinatura.trim().toLowerCase());
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export type Resultado =
  | { status: 'ignorado'; motivo: string }
  | { status: 'respondido'; intencao: Intencao['tipo']; texto: string };

export interface Dependencias {
  interpretarIA?: typeof interpretarComClaude;
  registrar?: typeof registrarNoBanco;
  enviar?: typeof responder;
  agora?: Date;
}

/**
 * Uma mensagem recebida → no máximo uma resposta para a mesma conversa.
 * Ignora (sem responder): eventos que não são mensagem, mensagens nossas, grupos/canais/status, mídia sem
 * texto e números fora da lista. Assim o bot nunca puxa conversa nem responde estranhos.
 */
export async function processarEvento(evento: unknown, deps: Dependencias = {}): Promise<Resultado> {
  const { interpretarIA = interpretarComClaude, registrar = registrarNoBanco, enviar = responder, agora = new Date() } = deps;
  const e = (evento ?? {}) as { event?: unknown; payload?: Record<string, unknown> };
  if (e.event !== 'message' || !e.payload) return { status: 'ignorado', motivo: 'evento' };
  const p = e.payload;
  if (p.fromMe === true) return { status: 'ignorado', motivo: 'proprio' };
  const chatId = typeof p.from === 'string' ? p.from : '';
  if (!chatId || /@(?:g\.us|newsletter|broadcast)$/.test(chatId) || chatId === 'status@broadcast') return { status: 'ignorado', motivo: 'grupo' };
  const texto = typeof p.body === 'string' ? p.body.trim() : '';
  if (!texto) return { status: 'ignorado', motivo: 'sem_texto' };
  const telefone = telefoneDoPayload(p);
  if (!telefone || !numeroPermitido(telefone, process.env.WHATSAPP_NUMEROS_PERMITIDOS)) return { status: 'ignorado', motivo: 'fora_da_lista' };

  const hojeISO = hojeSP(agora);
  let intencao = interpretarPorRegras(texto, { hojeISO, horaSP: horaSP(agora) });
  if (intencao.tipo === 'desconhecido') intencao = (await interpretarIA(texto, hojeISO)) ?? intencao;

  let resposta: string;
  if (ehEscrita(intencao)) {
    const r = await registrar(telefone, typeof p.id === 'string' ? p.id : null, intencao);
    if (r.duplicada) return { status: 'ignorado', motivo: 'duplicada' };
    resposta = r.ok ? confirmacao(intencao, r.nome) : erroRpc(r.erro);
  } else {
    resposta = intencao.tipo === 'ajuda' ? AJUDA : NAO_ENTENDI;
  }
  await enviar(chatId, resposta);
  return { status: 'respondido', intencao: intencao.tipo, texto: resposta };
}
