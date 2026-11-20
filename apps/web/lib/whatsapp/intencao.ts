import type { TipoRefeicaoRapida } from '@meudia/shared';

/** O que uma mensagem pede. Tipos de escrita espelham `public.whatsapp_registrar` (migration 010). */
export type Intencao =
  | { tipo: 'gasto' | 'entrada'; valor: number; descricao: string; categoria: string; data?: string; pagar?: boolean }
  | { tipo: 'gasto'; valor: null; descricao: string; categoria: string; pagar: true; data?: string }
  | { tipo: 'treino'; descricao: string; duracao_min: number | null; data?: string }
  | { tipo: 'refeicao'; refeicao: TipoRefeicaoRapida; descricao: string; data?: string }
  | { tipo: 'desfazer' }
  | { tipo: 'lembrar'; fato: string }
  | { tipo: 'esquecer' }
  | { tipo: 'lembretes'; ativos: boolean | null; hora: number | null }
  | { tipo: 'ajuda' }
  | { tipo: 'desconhecido' };

export type IntencaoEscrita = Extract<Intencao, { tipo: 'gasto' | 'entrada' | 'treino' | 'refeicao' }>;

export function ehEscrita(i: Intencao): i is IntencaoEscrita {
  return i.tipo === 'gasto' || i.tipo === 'entrada' || i.tipo === 'treino' || i.tipo === 'refeicao';
}
