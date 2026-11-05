import type { AcaoRapida, MensagemChat, NotificacaoAgente, RespostaAgente, TipoIntencao } from '@meudia/shared';
import { classificarIntencao } from '@meudia/ai';
import { isRotaVisivel, type AppMode } from './app-mode';

/** Conteúdo do AgentPanel filtrado pelo APP_MODE (modo Finanças: finanças; a rota /treinos também é visível). */

export type AbaAgente = 'resumo' | 'treino' | 'alertas';

/** Modo Finanças: sem a aba Resumo (treinos/hábitos) e abre direto no Chat. */
export function abasAgente(mode: AppMode): AbaAgente[] {
  return mode === 'financas' ? ['treino', 'alertas'] : ['resumo', 'treino', 'alertas'];
}

export function abaInicialAgente(mode: AppMode): AbaAgente {
  return mode === 'financas' ? 'treino' : 'resumo';
}

// Ações que dependem de módulos ocultos no modo Finanças.
const ACOES_SO_PADRAO = new Set(['CRIAR_COMPROMISSO']);

export function isAcaoPermitida(acao: Pick<AcaoRapida, 'acao' | 'payload'>, mode: AppMode): boolean {
  if (mode === 'padrao') return true;
  if (ACOES_SO_PADRAO.has(acao.acao)) return false;
  if (acao.acao === 'NAVEGAR') {
    const rota = acao.payload?.rota;
    return typeof rota === 'string' && isRotaVisivel(rota.split('?')[0] ?? rota, mode);
  }
  return true;
}

export function filtrarAcoes(acoes: readonly AcaoRapida[] | null | undefined, mode: AppMode): AcaoRapida[] {
  return (acoes ?? []).filter((a) => isAcaoPermitida(a, mode));
}

const SUGESTOES_FINANCAS: AcaoRapida[] = [
  { label: 'Resumo financeiro', acao: 'COMANDO', payload: { comando: 'como estão minhas finanças?' } },
  { label: 'Quanto gastei?', acao: 'COMANDO', payload: { comando: 'quanto gastei este mês?' } },
  { label: 'Ver contas', acao: 'NAVEGAR', payload: { rota: '/financas/contas' } },
  { label: 'Ver orçamento', acao: 'NAVEGAR', payload: { rota: '/financas/orcamento' } },
];

/** Sugestões iniciais do chat; no modo padrão mantém as do agente. */
export function sugestoesAgente(mode: AppMode, padrao: () => AcaoRapida[]): AcaoRapida[] {
  return mode === 'financas' ? SUGESTOES_FINANCAS : padrao();
}

/** Modo Finanças: só notificações do módulo finanças, e só com ações permitidas. */
export function filtrarNotificacoes(notificacoes: readonly NotificacaoAgente[], mode: AppMode): NotificacaoAgente[] {
  if (mode === 'padrao') return [...notificacoes];
  return notificacoes
    .filter((n) => n.modulo === 'financas')
    .map((n) => ({ ...n, acoes: filtrarAcoes(n.acoes, mode) }));
}

// Treinos saiu desta lista: o módulo aparece no modo Finanças (decisão do Estevam, 04/11/2026; C6 do PLANO-F1).
type ModuloOculto = 'agenda' | 'habitos' | 'notas';

const MODULO_POR_INTENCAO: Partial<Record<TipoIntencao, ModuloOculto>> = {
  CRIAR_COMPROMISSO: 'agenda',
  CONSULTA_AGENDA: 'agenda',
  CRIAR_HABITO: 'habitos',
  CONSULTA_HABITOS: 'habitos',
  CONSULTA_NOTAS: 'notas',
};

const NOME_MODULO: Record<ModuloOculto, string> = {
  agenda: 'A agenda (compromissos e tarefas) não está disponível',
  habitos: 'Hábitos não estão disponíveis',
  notas: 'Notas não estão disponíveis',
};

export function mensagemModuloIndisponivel(modulo: ModuloOculto): string {
  return `${NOME_MODULO[modulo]} no modo Finanças. Aqui eu anoto gastos e acompanho suas contas: tente "gastei 45 no mercado".`;
}

/** Módulo oculto que uma ação removida pelo filtro levaria (Criar Agora, Abrir Agenda...). */
function moduloDaAcao(acao: AcaoRapida): ModuloOculto | null {
  if (acao.acao === 'CRIAR_COMPROMISSO') return 'agenda';
  const rota = acao.acao === 'NAVEGAR' ? acao.payload?.rota : undefined;
  if (typeof rota !== 'string') return null;
  const modulo = (['agenda', 'habitos', 'notas'] as const).find((m) => rota === `/${m}` || rota.startsWith(`/${m}/`) || rota.startsWith(`/${m}?`));
  return modulo ?? null;
}

function moduloRemovido(acoes: readonly AcaoRapida[] | null | undefined, mode: AppMode): ModuloOculto | null {
  for (const a of acoes ?? []) {
    if (isAcaoPermitida(a, mode)) continue;
    const modulo = moduloDaAcao(a);
    if (modulo) return modulo;
  }
  return null;
}

/**
 * Modo Finanças: o motor de regras (pacote ai) não conhece o modo. Se o texto pede agenda/tarefa,
 * hábito ou notas, ou se a resposta oferecia ação desses módulos, a resposta diz que o módulo não está
 * disponível, em vez de citar um botão ("Criar Agora", "Abrir Agenda") que o filtro tirou.
 */
export function adaptarRespostaAoModo(texto: string, resposta: RespostaAgente, mode: AppMode): RespostaAgente {
  if (mode === 'padrao') return resposta;
  const modulo = MODULO_POR_INTENCAO[classificarIntencao(texto).tipo] ?? moduloRemovido(resposta.acoes, mode);
  if (!modulo) return { ...resposta, acoes: filtrarAcoes(resposta.acoes, mode) };
  return { mensagem: mensagemModuloIndisponivel(modulo), acoes: SUGESTOES_FINANCAS.slice(0, 2) };
}

/** Remove das mensagens do chat ações que levariam a módulos ocultos (e reescreve o texto que as citava). */
export function filtrarMensagens(mensagens: readonly MensagemChat[], mode: AppMode): MensagemChat[] {
  if (mode === 'padrao') return [...mensagens];
  return mensagens.map((m) => {
    const modulo = m.role === 'agent' ? moduloRemovido(m.acoes, mode) : null;
    return { ...m, ...(modulo ? { conteudo: mensagemModuloIndisponivel(modulo) } : {}), acoes: filtrarAcoes(m.acoes, mode) };
  });
}
