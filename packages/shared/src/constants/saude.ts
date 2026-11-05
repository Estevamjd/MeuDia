/**
 * Saúde e Treino: regras de cálculo fechadas pelo Estevam (04/11/2026, design-system B §5 e PLANO-F1 §10).
 * Trocar um número aqui muda a conta em todo o app; `FORMULA_SAUDE_VERSAO` registra qual regra gerou a meta.
 */

/** Mifflin-St Jeor, versão simplificada (Mifflin et al., Am J Clin Nutr 1990;51(2):241–247, PMID 2305711). */
export const MIFFLIN = {
  PESO: 10,
  ALTURA: 6.25,
  IDADE: 5,
  MASCULINO: 5,
  FEMININO: -161,
} as const;

export type SexoFormula = 'masculino' | 'feminino';
export type NivelAtividade = 'leve' | 'moderado' | 'intenso';
export type ObjetivoSaude = 'manter' | 'ganhar';

/** Um fator só, que já conta o treino (borda de baixo das faixas PAL da FAO/WHO/UNU 2004). */
export const FATORES_ATIVIDADE: Record<NivelAtividade, number> = {
  leve: 1.4,
  moderado: 1.7,
  intenso: 2.0,
};

/** Ganhar peso = gasto estimado + 10% (Iraki et al. 2019, borda de baixo de +10–20%). Manter = gasto. */
export const FATOR_GANHO = 1.1;

export const PROTEINA_G_KG_PADRAO = 1.8;
export const PROTEINA_G_KG_MIN = 1.4;
export const PROTEINA_G_KG_MAX = 2.2;

/** Ritmo de ganho em % do peso por semana (Iraki et al. 2019, Sports 7(7):154). Não muda a meta de calorias. */
export const GANHO_SEMANAL_MIN_PCT = 0.25;
export const GANHO_SEMANAL_MEIO_PCT = 0.375;
export const GANHO_SEMANAL_MAX_PCT = 0.5;
export const GANHO_SEMANAL_MAX_PCT_AVANCADO = 0.25;
export const RITMOS_SEMANAIS_PCT = [GANHO_SEMANAL_MIN_PCT, GANHO_SEMANAL_MEIO_PCT, GANHO_SEMANAL_MAX_PCT] as const;

export const FORMULA_SAUDE_VERSAO = 'mifflin1990-fao2004-v1';

/** Citação da TACO (o PDF oficial permite reproduzir "desde que citada a fonte"). */
export const TACO_CITACAO_CURTA = 'Valores de referência: TACO 4ª ed. (NEPA/UNICAMP, 2011).';
export const TACO_CITACAO =
  'UNICAMP/NEPA. Tabela Brasileira de Composição de Alimentos – TACO. 4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011.';

/** Aviso do cadastro (design-system B §5, ANEXO-ONBOARDING §5.6) sem "O app ajusta pela sua tendência de peso": o ajuste não existe (decisão do Chief, 05/11). */
export const AVISO_ESTIMATIVA_SAUDE =
  'Estimativa baseada em médias (fórmula Mifflin-St Jeor). Seu corpo pode gastar mais ou menos. Não é orientação médica.';
