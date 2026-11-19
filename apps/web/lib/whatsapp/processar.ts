import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hojeSP } from '@meudia/shared';
import { horaSP } from '../../components/registros/datas';
import { interpretarComClaude } from './claude';
import { aplicarEstilo, contatoDoRpc } from './contato';
import { ehEscrita, type Intencao } from './intencao';
import { passoOnboarding, type ExtrairIA } from './onboarding';
import { conversar, extrairOnboardingIA } from './persona';
import { interpretarPorRegras } from './regras';
import { AJUDA, FALHOU, LIMITE_DIA, NAO_ENTENDI, confirmacao, erroRpc } from './respostas';
import { buscarContato, registrarNoBanco, responder, salvarOnboarding } from './servicos';
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
  | { status: 'respondido'; intencao: Intencao['tipo'] | 'onboarding' | 'conversa' | 'limite'; texto: string };

export interface Dependencias {
  interpretarIA?: typeof interpretarComClaude;
  extrairIA?: ExtrairIA;
  conversarIA?: typeof conversar;
  contato?: typeof buscarContato;
  onboarding?: typeof salvarOnboarding;
  registrar?: typeof registrarNoBanco;
  enviar?: typeof responder;
  agora?: Date;
}

/** Portão: só a lista de permitidos, ou qualquer número se WHATSAPP_ONBOARDING_ABERTO=true (padrão: fechado). */
export function podeConversar(telefone: string): boolean {
  return numeroPermitido(telefone, process.env.WHATSAPP_NUMEROS_PERMITIDOS) || process.env.WHATSAPP_ONBOARDING_ABERTO === 'true';
}

export function limiteDiario(): number {
  const n = Number(process.env.WHATSAPP_LIMITE_DIA);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://meudia.srv2176785.hstgr.cloud').replace(/\/$/, '');

/**
 * Uma mensagem recebida → no máximo uma resposta para a mesma conversa (nada proativo).
 * Ignora (sem responder): eventos que não são mensagem, mensagens nossas, grupos/canais/status, mídia sem
 * texto e números fora do portão. Número sem conta → onboarding; com conta → registra e responde.
 */
export async function processarEvento(evento: unknown, deps: Dependencias = {}): Promise<Resultado> {
  const {
    interpretarIA = interpretarComClaude,
    extrairIA = extrairOnboardingIA,
    conversarIA = conversar,
    contato: buscar = buscarContato,
    onboarding = salvarOnboarding,
    registrar = registrarNoBanco,
    enviar = responder,
    agora = new Date(),
  } = deps;
  const e = (evento ?? {}) as { event?: unknown; payload?: Record<string, unknown> };
  if (e.event !== 'message' || !e.payload) return { status: 'ignorado', motivo: 'evento' };
  const p = e.payload;
  if (p.fromMe === true) return { status: 'ignorado', motivo: 'proprio' };
  const chatId = typeof p.from === 'string' ? p.from : '';
  if (!chatId || /@(?:g\.us|newsletter|broadcast)$/.test(chatId) || chatId === 'status@broadcast') return { status: 'ignorado', motivo: 'grupo' };
  const texto = typeof p.body === 'string' ? p.body.trim() : '';
  if (!texto) return { status: 'ignorado', motivo: 'sem_texto' };
  const telefone = telefoneDoPayload(p);
  if (!telefone || !podeConversar(telefone)) return { status: 'ignorado', motivo: 'fora_da_lista' };

  const responderCom = async (intencao: Exclude<Resultado, { status: 'ignorado' }>['intencao'], texto: string): Promise<Resultado> => {
    await enviar(chatId, texto);
    return { status: 'respondido', intencao, texto };
  };

  const limite = limiteDiario();
  const r = await buscar(telefone, limite);
  if (!r.ok) return responderCom('desconhecido', FALHOU);
  const contato = contatoDoRpc(r);
  if (contato.limiteExcedido) {
    // Avisa uma vez só; depois fica quieto até amanhã (custo e risco de banimento).
    return contato.msgsHoje === limite + 1 ? responderCom('limite', aplicarEstilo(LIMITE_DIA(appUrl()), contato.estilo)) : { status: 'ignorado', motivo: 'limite' };
  }

  // ── Sem conta: onboarding ──
  if (!contato.vinculado) {
    const passo = await passoOnboarding(contato, texto, extrairIA);
    const salvo = await onboarding(telefone, passo.dados, passo.gerarToken);
    if (!salvo.ok || (passo.gerarToken && !salvo.token)) return responderCom('onboarding', FALHOU);
    const link = salvo.token ? `${appUrl()}/whatsapp?t=${salvo.token}` : '';
    return responderCom('onboarding', passo.resposta.replace('{LINK}', link));
  }

  // ── Com conta: registrar ──
  const hojeISO = hojeSP(agora);
  let intencao = interpretarPorRegras(texto, { hojeISO, horaSP: horaSP(agora) });
  if (intencao.tipo === 'desconhecido') intencao = (await interpretarIA(texto, hojeISO)) ?? intencao;

  if (ehEscrita(intencao)) {
    const reg = await registrar(telefone, typeof p.id === 'string' ? p.id : null, intencao);
    if (reg.duplicada) return { status: 'ignorado', motivo: 'duplicada' };
    return responderCom(intencao.tipo, reg.ok ? confirmacao(intencao, reg.nome ?? contato.nome, reg.extras, contato.estilo) : erroRpc(reg.erro));
  }
  if (intencao.tipo === 'ajuda') return responderCom('ajuda', aplicarEstilo(AJUDA, contato.estilo));
  const livre = await conversarIA(contato, texto, hojeISO);
  return livre ? responderCom('conversa', aplicarEstilo(livre, contato.estilo)) : responderCom('desconhecido', aplicarEstilo(NAO_ENTENDI, contato.estilo));
}
