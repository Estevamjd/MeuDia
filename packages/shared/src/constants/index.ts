export const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export const OBJETIVOS = {
  saude_geral: 'Saúde Geral',
  emagrecer: 'Emagrecer',
  ganhar_massa: 'Ganhar Massa',
  condicionamento: 'Condicionamento',
} as const;

export const TIPOS_TREINO = {
  musculacao: 'Musculação',
  cardio: 'Cardio',
  funcional: 'Funcional',
  descanso: 'Descanso',
} as const;

export const PONTUACAO = {
  TREINO_CONCLUIDO: 30,
  META_HABITOS: 20,
  META_AGUA: 15,
  META_CALORIAS: 20,
  MEDICAMENTOS_TOMADOS: 15,
  SCORE_MINIMO_STREAK: 60,
} as const;

export const CACHE = {
  STALE_TIME: 1000 * 60 * 5,
  CACHE_TIME: 1000 * 60 * 30,
} as const;

export const APP_NAME = 'MeuDia';
