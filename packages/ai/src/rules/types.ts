import type { AIPrioridade } from '@meudia/shared';

export interface AIContexto {
  // Treinos
  temTreinoHoje: boolean;
  treinoHojeConcluido: boolean;
  nomeTreino: string | null;
  ultimaCarga: number | null;
  faltouTreinoOntem: boolean;
  treinosNaSemana: number;
  metaTreinosSemana: number;

  // Hábitos
  percentualHabitosHoje: number;
  habitosPendentes: string[];
  streakAtual: number;

  // Score
  scoreHoje: number;
  scoreMedio7dias: number;

  // Dieta
  coposAgua: number;
  metaAgua: number;
  caloriasHoje: number;
  metaCalorias: number;
  refeicoesHoje: number;

  // Medicamentos
  medicamentosPendentes: number;
  medicamentosTomados: number;
  estoqueBaixo: string[];

  // Agenda
  compromissosHoje: number;
  compromissosPendentes: number;

  // Finanças
  saldoMes: number;
  despesasMes: number;

  // Temporal
  horaAtual: number;
  diaSemana: number;
}

export interface AIRule {
  id: string;
  modulo: string;
  condicao: (ctx: AIContexto) => boolean;
  mensagem: (ctx: AIContexto) => string;
  prioridade: AIPrioridade;
}

export interface AIMensagem {
  id: string;
  modulo: string;
  mensagem: string;
  prioridade: AIPrioridade;
}
