import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hojeSP } from '@meudia/shared';
import { horaSP } from '../../components/registros/datas';
import { interpretarComClaude } from './claude';
import { aplicarEstilo, contatoDoRpc } from './contato';
import { ehEscrita, type Intencao } from './intencao';
import { ganchoDaMeta } from './ganchos';
import { passoOnboarding, type ExtrairIA } from './onboarding';
import { comentarComHumor, conversar, extrairOnboardingIA } from './persona';
import { interpretarPorRegras } from './regras';
import { AJUDA, ESQUECI, FALHOU, LEMBREI, LEMBRETE_HORA, LEMBRETE_HORA_INVALIDA, LEMBRETES_PARADOS, LEMBRETES_VOLTARAM, LIMITE_DIA, NADA_PARA_DESFAZER, NAO_ENTENDI, confirmacao, confirmacaoDesfazer, erroRpc } from './respostas';
import { buscarContato, configurarLembretes, desfazerUltimo, lembrarFato, registrarNoBanco, responder, salvarOnboarding } from './servicos';
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
  | { status: 'respondido'; intencao: Intencao['tipo'] | 'onboarding' | 'conversa' | 'limite';
      comentario?: boolean; texto: string };

export interface Dependencias {
  interpretarIA?: typeof interpretarComClaude;
  extrairIA?: ExtrairIA;
  conversarIA?: typeof conversar;
  comentarIA?: typeof comentarComHumor;
  lembrar?: typeof lembrarFato;
  lembretes?: typeof configurarLembretes;
  desfazer?: typeof desfazerUltimo;
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
    comentarIA = comentarComHumor,
    lembrar = lembrarFato,
    lembretes = configurarLembretes,
    desfazer = desfazerUltimo,
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
    if (!reg.ok) return responderCom(intencao.tipo, erroRpc(reg.erro));
    // Amigo que conhece a pessoa: só comenta quando o registro cruza com uma meta dela (regra decide; IA só escreve).
    const gancho = ganchoDaMeta(intencao, contato, reg.extras);
    const comentario = gancho ? await comentarIA({ contato, intencao, gancho, extras: reg.extras, hojeISO }) : null;
    const r = await responderCom(intencao.tipo, confirmacao(intencao, reg.nome ?? contato.nome, reg.extras, contato.estilo, comentario));
    return comentario ? { ...r, comentario: true } as Resultado : r;
  }
  if (intencao.tipo === 'desfazer') {
    const d = await desfazer(telefone, typeof p.id === 'string' ? p.id : null);
    if (d.duplicada) return { status: 'ignorado', motivo: 'duplicada' };
    if (!d.ok) return responderCom('desfazer', FALHOU);
    const texto = d.desfeito ? confirmacaoDesfazer(d)
      : d.ja_desfeito ? 'Já desfiz o último registro.'
      : d.ja_apagado ? 'Esse registro já tinha sido apagado no app.'
      : NADA_PARA_DESFAZER;
    return responderCom('desfazer', aplicarEstilo(texto, contato.estilo));
  }
  if (intencao.tipo === 'lembretes') {
    if (intencao.hora != null && (intencao.hora < 8 || intencao.hora > 21)) return responderCom('lembretes', aplicarEstilo(LEMBRETE_HORA_INVALIDA, contato.estilo));
    const r = await lembretes(telefone, intencao.hora != null ? true : intencao.ativos, intencao.hora);
    if (!r.ok) return responderCom('lembretes', FALHOU);
    const txt = intencao.hora != null ? LEMBRETE_HORA(intencao.hora) : intencao.ativos ? LEMBRETES_VOLTARAM : LEMBRETES_PARADOS;
    return responderCom('lembretes', aplicarEstilo(txt, contato.estilo));
  }
  if (intencao.tipo === 'lembrar' || intencao.tipo === 'esquecer') {
    const r = await lembrar(telefone, intencao.tipo === 'lembrar' ? intencao.fato : null);
    if (!r.ok) return responderCom(intencao.tipo, FALHOU);
    return responderCom(intencao.tipo, aplicarEstilo(intencao.tipo === 'lembrar' ? LEMBREI(contato.nome) : ESQUECI, contato.estilo));
  }
  if (intencao.tipo === 'ajuda') return responderCom('ajuda', aplicarEstilo(AJUDA, contato.estilo));
  const livre = await conversarIA(contato, texto, hojeISO);
  return livre ? responderCom('conversa', aplicarEstilo(livre, contato.estilo)) : responderCom('desconhecido', aplicarEstilo(NAO_ENTENDI, contato.estilo));
}
