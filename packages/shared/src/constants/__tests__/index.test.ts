import {
  DIAS_SEMANA,
  DIAS_SEMANA_CURTO,
  OBJETIVOS,
  TIPOS_TREINO,
  PONTUACAO,
  CACHE,
} from '../index';

describe('DIAS_SEMANA', () => {
  it('has 7 entries', () => {
    expect(DIAS_SEMANA).toHaveLength(7);
  });
});

describe('DIAS_SEMANA_CURTO', () => {
  it('has 7 entries', () => {
    expect(DIAS_SEMANA_CURTO).toHaveLength(7);
  });
});

describe('OBJETIVOS', () => {
  it('has 4 entries', () => {
    expect(Object.keys(OBJETIVOS)).toHaveLength(4);
  });
});

describe('TIPOS_TREINO', () => {
  it('has 4 entries', () => {
    expect(Object.keys(TIPOS_TREINO)).toHaveLength(4);
  });
});

describe('PONTUACAO', () => {
  it('TREINO_CONCLUIDO equals 30', () => {
    expect(PONTUACAO.TREINO_CONCLUIDO).toBe(30);
  });

  it('META_HABITOS equals 20', () => {
    expect(PONTUACAO.META_HABITOS).toBe(20);
  });

  it('META_AGUA equals 15', () => {
    expect(PONTUACAO.META_AGUA).toBe(15);
  });

  it('META_CALORIAS equals 20', () => {
    expect(PONTUACAO.META_CALORIAS).toBe(20);
  });

  it('MEDICAMENTOS_TOMADOS equals 15', () => {
    expect(PONTUACAO.MEDICAMENTOS_TOMADOS).toBe(15);
  });

  it('scoring values sum to 100', () => {
    const sum =
      PONTUACAO.TREINO_CONCLUIDO +
      PONTUACAO.META_HABITOS +
      PONTUACAO.META_AGUA +
      PONTUACAO.META_CALORIAS +
      PONTUACAO.MEDICAMENTOS_TOMADOS;

    expect(sum).toBe(100);
  });
});

describe('CACHE', () => {
  it('has STALE_TIME defined', () => {
    expect(CACHE.STALE_TIME).toBeDefined();
    expect(typeof CACHE.STALE_TIME).toBe('number');
  });

  it('has CACHE_TIME defined', () => {
    expect(CACHE.CACHE_TIME).toBeDefined();
    expect(typeof CACHE.CACHE_TIME).toBe('number');
  });
});
