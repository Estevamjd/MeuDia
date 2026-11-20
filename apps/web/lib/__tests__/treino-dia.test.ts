import { describe, expect, it } from 'vitest';
import type { RegistroTreino, SessaoTreino } from '@meudia/shared';
import { resumoSemana } from '@meudia/shared';
import { TITULO_SESSAO_SEM_NOME, unirTreinosDoDia } from '../treino-dia';

const rapido = (data: string, extra: Partial<RegistroTreino> = {}): RegistroTreino => ({
  id: `r-${data}-${extra.descricao ?? 'x'}`, user_id: 'u1', data, descricao: 'Peito', duracao_min: 40, origem: 'app',
  created_at: `${data}T20:00:00Z`, ...extra,
});
const sessao = (data: string, extra: Partial<SessaoTreino> = {}): SessaoTreino => ({
  id: `s-${data}-${extra.treino_id ?? 't1'}`, user_id: 'u1', treino_id: 't1', data, duracao_minutos: 55, concluido: true,
  observacao: null, created_at: `${data}T11:00:00Z`, ...extra,
});
const treinos = [{ id: 't1', nome: 'Treino A' }];

// Sexta 20/11/2026: semana de 16/11 (seg) a 22/11 (dom).
const HOJE = '2026-11-20';

describe('aba Treino = Treino rápido + sessões concluídas do Plano (regra do dia)', () => {
  it('sessão concluída no Plano conta como treino no dia dela (sem Treino rápido)', () => {
    const itens = unirTreinosDoDia([], [sessao(HOJE)], treinos);
    expect(itens).toEqual([expect.objectContaining({ tipo: 'plano', data: HOJE, titulo: 'Treino A', duracao_min: 55 })]);
    const semana = resumoSemana(itens, HOJE);
    expect(semana.dias[4]).toBe(true);
    expect(semana).toMatchObject({ diasAtivos: 1, quantidade: 1, minutos: 55 });
  });

  it('mesmo dia com Treino rápido e sessão do Plano: conta só o rápido (sem treino nem minutos em dobro)', () => {
    const itens = unirTreinosDoDia([rapido(HOJE)], [sessao(HOJE)], treinos);
    expect(itens.map((i) => i.tipo)).toEqual(['rapido']);
    expect(resumoSemana(itens, HOJE)).toMatchObject({ diasAtivos: 1, quantidade: 1, minutos: 40 });
  });

  it('dias diferentes somam: rápido na quarta + Plano na sexta = 2 dias, 2 treinos', () => {
    const itens = unirTreinosDoDia([rapido('2026-11-18')], [sessao(HOJE)], treinos);
    expect(itens.map((i) => [i.tipo, i.data])).toEqual([['plano', HOJE], ['rapido', '2026-11-18']]);
    expect(resumoSemana(itens, HOJE)).toMatchObject({ diasAtivos: 2, quantidade: 2, minutos: 95 });
  });

  it('sessão em andamento (não concluída) não conta', () => {
    expect(unirTreinosDoDia([], [sessao(HOJE, { concluido: false })], treinos)).toEqual([]);
  });

  it('duas sessões concluídas do Plano no mesmo dia sem rápido contam as duas (dia conta uma vez)', () => {
    const itens = unirTreinosDoDia([], [sessao(HOJE), sessao(HOJE, { treino_id: 't2', created_at: `${HOJE}T21:00:00Z` })], treinos);
    expect(itens.map((i) => i.titulo)).toEqual([TITULO_SESSAO_SEM_NOME, 'Treino A']);
    expect(resumoSemana(itens, HOJE)).toMatchObject({ diasAtivos: 1, quantidade: 2 });
  });

  it('sessão do Plano sem nome conhecido (treino apagado ou nomes ainda carregando) vira "Treino do plano"', () => {
    expect(unirTreinosDoDia([], [sessao(HOJE, { treino_id: null })])[0]?.titulo).toBe(TITULO_SESSAO_SEM_NOME);
  });

  it('a sequência de semanas conta semanas só com Plano', () => {
    const itens = unirTreinosDoDia([], [sessao('2026-11-11'), sessao(HOJE)], treinos);
    expect(resumoSemana(itens, HOJE).sequenciaSemanas).toBe(2);
  });
});
