import type { AIRule } from './types';

export const regrasDieta: AIRule[] = [
  {
    id: 'agua_baixa_tarde',
    modulo: 'geral',
    condicao: (ctx) => ctx.horaAtual >= 14 && ctx.coposAgua < ctx.metaAgua * 0.5,
    mensagem: (ctx) =>
      `Já é tarde e você bebeu apenas ${ctx.coposAgua}/${ctx.metaAgua} copos de água. Hidrate-se!`,
    prioridade: 'aviso',
  },
  {
    id: 'agua_quase_la',
    modulo: 'geral',
    condicao: (ctx) => ctx.coposAgua >= ctx.metaAgua * 0.75 && ctx.coposAgua < ctx.metaAgua,
    mensagem: (ctx) =>
      `Faltam apenas ${ctx.metaAgua - ctx.coposAgua} copos para bater a meta de água!`,
    prioridade: 'info',
  },
  {
    id: 'agua_meta_batida',
    modulo: 'geral',
    condicao: (ctx) => ctx.coposAgua >= ctx.metaAgua,
    mensagem: () => 'Meta de água batida! Ótimo trabalho mantendo a hidratação.',
    prioridade: 'info',
  },
  {
    id: 'poucas_refeicoes',
    modulo: 'geral',
    condicao: (ctx) => ctx.horaAtual >= 18 && ctx.refeicoesHoje < 2,
    mensagem: () =>
      'Você registrou poucas refeições hoje. Lembre-se de registrar o que comeu para acompanhar sua nutrição.',
    prioridade: 'aviso',
  },
  {
    id: 'calorias_muito_baixas',
    modulo: 'geral',
    condicao: (ctx) =>
      ctx.horaAtual >= 15 && ctx.caloriasHoje > 0 && ctx.caloriasHoje < ctx.metaCalorias * 0.4,
    mensagem: () =>
      'Suas calorias estão bem abaixo da meta. Não pule refeições — seu corpo precisa de combustível!',
    prioridade: 'aviso',
  },
];
