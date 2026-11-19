import { aplicarEstilo, primeiroNome, type Contato, type Estilo, type Etapa, type Meta } from './contato';
import { extrairValor } from './regras';

/**
 * Onboarding pelo WhatsApp: uma pergunta por vez, texto livre, "pular" em qualquer uma, no máximo
 * 2 tentativas por pergunta (depois segue sem o dado). Regras primeiro; a IA só entra quando a regra
 * não entende (nome, renda, metas, estilo). Ao final gera o link de uso único para ligar à conta.
 *
 * Função pura: recebe o contato e a mensagem, devolve o que gravar e o texto da resposta.
 * `{LINK}` na resposta é trocado pelo link real (o token só existe depois de gravar).
 */

export type Extraido = Partial<{ nome: string; renda: number; metas: Meta[]; estilo_tamanho: Estilo['tamanho']; estilo_emoji: boolean }>;
export type ExtrairIA = (etapa: 'nome' | 'renda' | 'metas' | 'estilo', texto: string) => Promise<Extraido | null>;

export interface PassoOnboarding {
  dados: Record<string, unknown>;
  gerarToken: boolean;
  resposta: string;
}

export const MAX_TENTATIVAS = 2;

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const ehPular = (t: string) => /^(?:pular|pula|pulo|passa|proxima|depois|prefiro nao(?: dizer| falar)?|nao quero(?: dizer| falar)?|sei la|nao sei)[!. ]*$/.test(semAcento(t));
const maiuscula = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_m, esp: string, l: string) => esp + l.toUpperCase());

// ── Regras por pergunta ──────────────────────────────────────────────────────
export function nomePorRegra(texto: string): string | null {
  let t = texto.trim().replace(/[!.?,;]+$/g, '');
  t = t.replace(/^(?:oi|ola|olá|e ai|eai|opa)[,!\s]+/i, '');
  t = t.replace(/^(?:meu nome (?:e|é)|me chamo|pode me chamar de|me chama de|sou (?:o|a)|eu sou (?:o|a)?|aqui (?:e|é) (?:o|a)?)\s+/i, '');
  if (!t || /\d/.test(t)) return null;
  const palavras = t.split(/\s+/);
  if (palavras.length > 3 || !palavras.every((p) => /^[\p{L}'-]{2,20}$/u.test(p))) return null;
  return maiuscula(palavras.slice(0, 2).join(' ').toLowerCase()).slice(0, 60);
}

export function rendaPorRegra(texto: string): number | null {
  const t = semAcento(texto).replace(/r\$\s*/g, '');
  const mil = /(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b(?:\s*e\s*(\d{1,3}))?/.exec(t);
  let valor: number | null = null;
  if (mil) valor = Number(mil[1]!.replace(',', '.')) * 1000 + (mil[2] ? Number(mil[2]) : 0);
  else valor = extrairValor(t)?.valor ?? null;
  return valor !== null && valor >= 50 && valor < 10_000_000 ? Math.round(valor * 100) / 100 : null;
}

export function metasPorRegra(texto: string): Meta[] | null {
  const t = semAcento(texto);
  if (/\b(?:tudo|todas?|todos|os tres|as tres|tudo isso)\b/.test(t)) return ['dinheiro', 'treino', 'dieta'];
  const metas: Meta[] = [];
  if (/dinheiro|grana|financ|gasto|econom|guardar|divida|orcamento|conta|💰/.test(t)) metas.push('dinheiro');
  if (/treino|treinar|academia|malh|muscul|corr|exercicio|🏋/.test(t)) metas.push('treino');
  if (/dieta|comer|comida|alimenta|refei|emagrec|peso|nutri|🥗/.test(t)) metas.push('dieta');
  return metas.length ? metas : null;
}

export function estiloPorRegra(texto: string): Extraido | null {
  const t = semAcento(texto);
  const out: Extraido = {};
  if (/curt|rapid|resum|diret|objetiv|pouco texto/.test(t)) out.estilo_tamanho = 'curto';
  else if (/detalh|complet|explica|longa|mais texto/.test(t)) out.estilo_tamanho = 'detalhado';
  if (/sem emoji|nada de emoji|nenhum emoji|(?:nao|odeio).{0,15}emoji/.test(t)) out.estilo_emoji = false;
  else if (/emoji|com carinha|pode usar/.test(t)) out.estilo_emoji = true;
  return Object.keys(out).length ? out : null;
}

// ── Textos ───────────────────────────────────────────────────────────────────
export const BOAS_VINDAS =
  'Oi, tudo bem? 😊 Eu sou o MeuDia, um assistente com inteligência artificial que anota seus gastos, treinos e refeições aqui mesmo no WhatsApp.\n\n' +
  'São 5 perguntinhas rápidas (pode responder "pular" em qualquer uma).\n\nPra começar: como você quer que eu te chame?';

const PERGUNTA: Record<'nome' | 'renda' | 'objetivo' | 'metas' | 'estilo', (nome: string) => string> = {
  nome: () => 'Como você quer que eu te chame?',
  renda: (n) => `${n ? `Prazer, ${n}! 🙌 ` : 'Combinado! '}Quanto você recebe por mês, mais ou menos? (ex.: 3.500) Uso só pra calcular quanto sobra no mês.`,
  objetivo: () => 'Anotado! Qual é o seu principal objetivo agora? (ex.: sair das dívidas, guardar pra viajar, ganhar massa)',
  metas: () => 'Boa! 💪 Em que você quer minha ajuda? Pode escolher mais de um: 💰 dinheiro, 🏋️ treino, 🥗 dieta (ou "tudo").',
  estilo: () => 'Última! Como prefere minhas respostas: *curtas* ou *detalhadas*? E com ou sem emoji?',
};

const REPERGUNTA: Record<'nome' | 'renda' | 'objetivo' | 'metas', string> = {
  nome: 'Só o primeiro nome já serve 🙂 Como posso te chamar?',
  renda: 'Não peguei o valor 🤔 Pode mandar só o número, tipo 2.800 (ou "pular").',
  objetivo: 'Me conta em poucas palavras o que você quer conquistar (ou "pular").',
  metas: 'Pode responder com "dinheiro", "treino", "dieta" ou "tudo" 😉',
};

function final(nome: string): string {
  return (
    `Prontinho${nome ? `, ${nome}` : ''}! ✅\n` +
    'Agora é só abrir este link pra criar sua senha e ligar seu WhatsApp à sua conta (vale 7 dias e é só seu):\n{LINK}\n\n' +
    'Depois é só me mandar coisas como "gastei 30 no uber" ou "treinei pernas 50min".\n' +
    'De vez em quando eu te dou um toque (treino do dia, conta vencendo), no máximo 2 por dia. Não curtiu? Manda "parar lembretes".'
  );
}

export const LEMBRAR_LINK = 'Falta só um passo! Abra este link pra ligar seu WhatsApp à sua conta MeuDia (o anterior deixa de valer):\n{LINK}';

const PROXIMA: Record<Exclude<Etapa, 'inicio' | 'link' | 'concluido'>, Etapa> = {
  nome: 'renda',
  renda: 'objetivo',
  objetivo: 'metas',
  metas: 'estilo',
  estilo: 'link',
};

// ── Máquina de estados ───────────────────────────────────────────────────────
export async function passoOnboarding(contato: Contato, texto: string, extrairIA: ExtrairIA): Promise<PassoOnboarding> {
  const estilo = contato.estilo;
  const com = (r: PassoOnboarding): PassoOnboarding => ({ ...r, resposta: aplicarEstilo(r.resposta, { ...estilo, ...estiloDos(r.dados) }) });
  const nome = primeiroNome(contato.nome);

  if (contato.etapa === 'inicio') return com({ dados: { etapa: 'nome', tentativas: 0 }, gerarToken: false, resposta: BOAS_VINDAS });
  if (contato.etapa === 'link' || contato.etapa === 'concluido') return com({ dados: {}, gerarToken: true, resposta: LEMBRAR_LINK });

  const etapa = contato.etapa;
  const pular = ehPular(texto);
  let valor: Record<string, unknown> | null = null;

  if (!pular) {
    if (etapa === 'nome') {
      const n = nomePorRegra(texto) ?? (await extrairIA('nome', texto))?.nome ?? null;
      if (n) valor = { nome: maiuscula(n.trim()).slice(0, 60) };
    } else if (etapa === 'renda') {
      const r = rendaPorRegra(texto) ?? (await extrairIA('renda', texto))?.renda ?? null;
      if (r && r >= 50 && r < 10_000_000) valor = { renda: Math.round(r * 100) / 100 };
    } else if (etapa === 'objetivo') {
      const o = texto.trim().replace(/\s+/g, ' ');
      if (o.length >= 3) valor = { objetivo: o.slice(0, 160) };
    } else if (etapa === 'metas') {
      const m = metasPorRegra(texto) ?? (await extrairIA('metas', texto))?.metas?.filter((x) => ['dinheiro', 'treino', 'dieta'].includes(x)) ?? null;
      if (m && m.length) valor = { metas: [...new Set(m)] };
    } else if (etapa === 'estilo') {
      const e = estiloPorRegra(texto) ?? (await extrairIA('estilo', texto)) ?? {};
      valor = {
        ...(e.estilo_tamanho ? { estilo_tamanho: e.estilo_tamanho } : {}),
        ...(typeof e.estilo_emoji === 'boolean' ? { estilo_emoji: e.estilo_emoji } : {}),
      };
    }
  }

  // Não entendeu: repergunta com exemplo; na 2ª vez segue sem o dado (nunca prende a pessoa).
  if (!pular && !valor && etapa !== 'estilo') {
    const tentativas = contato.tentativas + 1;
    if (tentativas < MAX_TENTATIVAS) return com({ dados: { tentativas }, gerarToken: false, resposta: REPERGUNTA[etapa] });
  }

  const proxima = PROXIMA[etapa];
  const dados: Record<string, unknown> = { ...(valor ?? {}), etapa: proxima, tentativas: 0 };
  const nomeAtual = typeof dados.nome === 'string' ? primeiroNome(dados.nome) : nome;
  const seguiuSem = !pular && !valor && etapa !== 'estilo' ? 'Sem problema, seguimos sem isso. ' : '';
  if (proxima === 'link') return com({ dados, gerarToken: true, resposta: final(nomeAtual) });
  return com({ dados, gerarToken: false, resposta: seguiuSem + PERGUNTA[proxima as keyof typeof PERGUNTA](etapa === 'nome' ? nomeAtual : nome) });
}

function estiloDos(dados: Record<string, unknown>): Partial<Estilo> {
  return typeof dados.estilo_emoji === 'boolean' ? { emoji: dados.estilo_emoji } : {};
}
