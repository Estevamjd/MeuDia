import type { DiaSemana, TipoRefeicao, TipoTreino } from '../types';

/**
 * Modelo inicial de treino (BRIEF §3.3, plano do Estevam). Toda conta pode usar e depois editar.
 * Só o que o BRIEF diz: nome, séries e faixa. Carga e descanso ficam vazios (a pessoa preenche).
 * As refeições do modelo (BRIEF §3.4) ficam em `MODELO_DIETA_V1`, só com nomes: sem gramas nem valor nutricional.
 * `ORIGEM_MODELO_TREINO` vai em `treinos.modelo_origem`/`exercicios.modelo_origem` (008) para aplicar uma vez só.
 */
export const ORIGEM_MODELO_TREINO = 'modelo-estevam-v1';

export interface ExercicioModelo {
  nome: string;
  series: number;
  /** null/null = série sem repetição (prancha). */
  repeticoes_min: number | null;
  repeticoes_max: number | null;
}

export interface TreinoModelo {
  dia_semana: DiaSemana;
  nome: string;
  tipo: TipoTreino;
  exercicios: ExercicioModelo[];
}

const ex = (nome: string, series: number, min: number | null, max: number | null): ExercicioModelo => ({
  nome,
  series,
  repeticoes_min: min,
  repeticoes_max: max,
});

/** dia_semana segue o banco: 0 = domingo … 6 = sábado. */
export const MODELO_TREINO_V1: readonly TreinoModelo[] = [
  {
    dia_semana: 1,
    nome: 'Superior A',
    tipo: 'musculacao',
    exercicios: [
      ex('Supino reto', 3, 8, 12),
      ex('Remada', 3, 8, 12),
      ex('Desenvolvimento', 2, 8, 12),
      ex('Puxada alta', 2, 10, 12),
      ex('Rosca bíceps', 2, 10, 15),
      ex('Tríceps polia', 2, 10, 15),
    ],
  },
  {
    dia_semana: 2,
    nome: 'Inferior A',
    tipo: 'musculacao',
    exercicios: [
      ex('Agachamento', 3, 8, 12),
      ex('Leg press', 2, 10, 12),
      ex('Mesa flexora', 3, 10, 12),
      ex('Panturrilha', 3, 12, 15),
      ex('Prancha', 3, null, null),
    ],
  },
  { dia_semana: 3, nome: 'Recuperação', tipo: 'descanso', exercicios: [] },
  {
    dia_semana: 4,
    nome: 'Superior B',
    tipo: 'musculacao',
    exercicios: [
      ex('Puxada alta', 3, 8, 12),
      ex('Supino inclinado', 3, 8, 12),
      ex('Remada baixa', 2, 10, 12),
      ex('Elevação lateral', 2, 12, 15),
      ex('Rosca martelo', 2, 10, 15),
      ex('Tríceps francês', 2, 10, 15),
    ],
  },
  {
    dia_semana: 5,
    nome: 'Inferior B',
    tipo: 'musculacao',
    exercicios: [
      ex('Levantamento romeno', 3, 8, 10),
      ex('Cadeira extensora', 3, 10, 12),
      ex('Agachamento guiado', 2, 10, 12),
      ex('Cadeira flexora', 2, 10, 12),
      ex('Panturrilha', 3, 12, 15),
    ],
  },
  { dia_semana: 6, nome: 'Descanso ou atividade leve', tipo: 'descanso', exercicios: [] },
  { dia_semana: 0, nome: 'Descanso ou atividade leve', tipo: 'descanso', exercicios: [] },
];

export interface RefeicaoModelo {
  tipo: TipoRefeicao;
  /** Nome mostrado na tela (o `tipo` vira só categoria; PLANO-F1 §3.2, P13). */
  nome: string;
  /** 'HH:MM'. */
  horario: string;
  /** Só os nomes do BRIEF; valor nutricional fica vazio até a pessoa preencher. */
  itens: readonly string[];
}

/**
 * Dia de refeições do modelo (BRIEF §3.4). Um horário por `tipo`, na ordem do dia.
 * Sem a 009 (`refeicoes.nome/horario`), é daqui que vêm o nome e a hora de cada refeição na tela.
 */
export const MODELO_DIETA_V1: readonly RefeicaoModelo[] = [
  { tipo: 'cafe', nome: 'Café da manhã', horario: '07:00', itens: ['2 pães franceses', '3 ovos', 'queijo'] },
  { tipo: 'lanche_manha', nome: 'Lanche', horario: '10:00', itens: ['banana', 'iogurte natural', 'aveia'] },
  { tipo: 'almoco', nome: 'Almoço', horario: '12:30', itens: ['arroz', 'feijão', 'frango', 'legumes'] },
  { tipo: 'lanche_tarde', nome: 'Lanche da tarde', horario: '17:00', itens: ['pão com ovos', 'banana'] },
  { tipo: 'jantar', nome: 'Vitamina', horario: '20:30', itens: ['Profit 28500', 'leite', 'banana'] },
  { tipo: 'ceia', nome: 'Jantar', horario: '21:30', itens: ['macarrão', 'carne moída', 'legumes'] },
];
