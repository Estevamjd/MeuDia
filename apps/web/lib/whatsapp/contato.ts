/** Estado do número no WhatsApp (tabela whatsapp_contatos, migration 011). */
export type Etapa = 'inicio' | 'nome' | 'renda' | 'objetivo' | 'metas' | 'estilo' | 'link' | 'concluido';
export type Meta = 'dinheiro' | 'treino' | 'dieta';

export interface Estilo {
  tamanho: 'curto' | 'detalhado';
  emoji: boolean;
}

export interface Contato {
  vinculado: boolean;
  etapa: Etapa;
  tentativas: number;
  nome: string | null;
  objetivo: string | null;
  metas: Meta[];
  /** Coisas que a pessoa pediu para lembrar (migration 012), mais antiga primeiro. */
  fatos: string[];
  estilo: Estilo;
  msgsHoje: number;
  limiteExcedido: boolean;
}

export const ESTILO_PADRAO: Estilo = { tamanho: 'curto', emoji: true };

/** Converte o JSON do RPC `whatsapp_contato`. */
export function contatoDoRpc(r: Record<string, unknown>): Contato {
  return {
    vinculado: r.vinculado === true,
    etapa: (r.etapa as Etapa) ?? 'inicio',
    tentativas: Number(r.tentativas ?? 0),
    nome: typeof r.nome === 'string' && r.nome ? r.nome : null,
    objetivo: typeof r.objetivo === 'string' ? r.objetivo : null,
    metas: Array.isArray(r.metas) ? (r.metas as Meta[]) : [],
    fatos: Array.isArray(r.fatos) ? (r.fatos as unknown[]).filter((f): f is string => typeof f === 'string').slice(-10) : [],
    estilo: { tamanho: r.estilo_tamanho === 'detalhado' ? 'detalhado' : 'curto', emoji: r.estilo_emoji !== false },
    msgsHoje: Number(r.msgs_hoje ?? 0),
    limiteExcedido: r.limite_excedido === true,
  };
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]\uFE0F?|\u200D|\uFE0F/gu;

/** Aplica a preferência de emoji (sem emoji = remove todos e arruma espaços). */
export function aplicarEstilo(texto: string, estilo: Estilo): string {
  if (estilo.emoji) return texto;
  return texto
    .replace(EMOJI, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/ +([!?.,:])/g, '$1')
    .trim();
}

export const primeiroNome = (nome: string | null | undefined) => (nome ? nome.trim().split(/\s+/)[0]! : '');
