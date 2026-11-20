import type { RegistroTreino, SessaoTreino, Treino } from '@meudia/shared';

/**
 * Aba Treino (/treinos) = Treino rápido (`registros_treino`) + sessões concluídas do Plano (`sessoes_treino`),
 * unidos só na leitura: nada é copiado de uma tabela para a outra e o schema não muda.
 *
 * Regra do dia (sem contar em dobro):
 * - dia com pelo menos um Treino rápido: contam só os rápidos (a pessoa já descreveu o treino do dia; a sessão
 *   do Plano no mesmo dia é o mesmo treino e não soma treino nem minutos);
 * - dia sem Treino rápido: cada sessão concluída do Plano conta como um treino, com a duração dela;
 * - sessão em andamento (não concluída) nunca conta.
 */
export type ItemTreino =
  | { tipo: 'rapido'; id: string; data: string; titulo: string; duracao_min: number | null; registro: RegistroTreino }
  | { tipo: 'plano'; id: string; data: string; titulo: string; duracao_min: number | null; sessao: SessaoTreino };

export const TITULO_SESSAO_SEM_NOME = 'Treino do plano';

export function unirTreinosDoDia(
  registros: readonly RegistroTreino[],
  sessoes: readonly SessaoTreino[],
  treinos: readonly Pick<Treino, 'id' | 'nome'>[] = [],
): ItemTreino[] {
  const diasComRapido = new Set(registros.map((r) => r.data));
  const nomes = new Map(treinos.map((t) => [t.id, t.nome]));

  const rapidos: ItemTreino[] = registros.map((r) => ({
    tipo: 'rapido',
    id: r.id,
    data: r.data,
    titulo: r.descricao,
    duracao_min: r.duracao_min,
    registro: r,
  }));
  const doPlano: ItemTreino[] = sessoes
    .filter((s) => s.concluido && !diasComRapido.has(s.data))
    .map((s) => ({
      tipo: 'plano',
      id: s.id,
      data: s.data,
      titulo: (s.treino_id && nomes.get(s.treino_id)) || TITULO_SESSAO_SEM_NOME,
      duracao_min: s.duracao_minutos,
      sessao: s,
    }));

  // Mais recente primeiro (como `registros_treino` já vem); empate no dia pela criação.
  const criadoEm = (i: ItemTreino) => (i.tipo === 'rapido' ? i.registro.created_at : i.sessao.created_at);
  return [...rapidos, ...doPlano].sort((a, b) => (a.data === b.data ? criadoEm(b).localeCompare(criadoEm(a)) : b.data.localeCompare(a.data)));
}
