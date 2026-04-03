import { classificarIntencao } from '../intencao';

describe('classificarIntencao', () => {
  describe('CONSULTA_TREINO', () => {
    it('identifica "treino hoje"', () => {
      const result = classificarIntencao('Qual é o treino hoje?');
      expect(result.tipo).toBe('CONSULTA_TREINO');
      expect(result.confianca).toBeGreaterThan(0.5);
    });

    it('identifica "meu treino"', () => {
      const result = classificarIntencao('Mostra meu treino');
      expect(result.tipo).toBe('CONSULTA_TREINO');
    });

    it('identifica consulta sobre carga', () => {
      const result = classificarIntencao('Quanto levantei no supino?');
      expect(result.tipo).toBe('CONSULTA_TREINO');
      expect(result.parametros?.exercicio).toBe('supino');
    });
  });

  describe('CRIAR_TREINO', () => {
    it('identifica "cria um treino"', () => {
      const result = classificarIntencao('Cria um treino de peito');
      expect(result.tipo).toBe('CRIAR_TREINO');
      expect(result.parametros?.grupoMuscular).toBe('peito');
    });

    it('identifica "monte um treino"', () => {
      const result = classificarIntencao('Monte um treino de pernas');
      expect(result.tipo).toBe('CRIAR_TREINO');
      expect(result.parametros?.grupoMuscular).toBe('pernas');
    });
  });

  describe('AGENDAR_TREINO', () => {
    it('identifica "agenda treino"', () => {
      const result = classificarIntencao('Agenda treino para segunda');
      expect(result.tipo).toBe('AGENDAR_TREINO');
      expect(result.parametros?.dia).toBe('segunda');
    });

    it('extrai horário', () => {
      const result = classificarIntencao('Marca treino na segunda às 18h30');
      expect(result.tipo).toBe('AGENDAR_TREINO');
      expect(result.parametros?.hora).toBe('18:30');
    });
  });

  describe('CONSULTA_HABITOS', () => {
    it('identifica "hábitos"', () => {
      const result = classificarIntencao('Como estão meus hábitos?');
      expect(result.tipo).toBe('CONSULTA_HABITOS');
    });

    it('identifica "streak"', () => {
      const result = classificarIntencao('Qual meu streak atual?');
      expect(result.tipo).toBe('CONSULTA_HABITOS');
    });

    it('identifica "não marquei"', () => {
      const result = classificarIntencao('O que eu não marquei hoje?');
      expect(result.tipo).toBe('CONSULTA_HABITOS');
    });
  });

  describe('CONSULTA_AGENDA', () => {
    it('identifica "amanhã"', () => {
      const result = classificarIntencao('O que tenho amanhã?');
      expect(result.tipo).toBe('CONSULTA_AGENDA');
    });

    it('identifica "compromisso"', () => {
      const result = classificarIntencao('Tenho algum compromisso?');
      expect(result.tipo).toBe('CONSULTA_AGENDA');
    });
  });

  describe('CONSULTA_FINANCAS', () => {
    it('identifica "gastei"', () => {
      const result = classificarIntencao('Quanto gastei esse mês?');
      expect(result.tipo).toBe('CONSULTA_FINANCAS');
    });

    it('identifica "saldo"', () => {
      const result = classificarIntencao('Qual meu saldo?');
      expect(result.tipo).toBe('CONSULTA_FINANCAS');
    });
  });

  describe('RESUMO_DIA', () => {
    it('identifica "resumo"', () => {
      const result = classificarIntencao('Me dá um resumo do dia');
      expect(result.tipo).toBe('RESUMO_DIA');
    });

    it('identifica "como foi meu dia"', () => {
      const result = classificarIntencao('Como foi meu dia hoje?');
      expect(result.tipo).toBe('RESUMO_DIA');
    });
  });

  describe('GENERICA', () => {
    it('retorna GENERICA para mensagem sem padrão', () => {
      const result = classificarIntencao('Olá, tudo bem?');
      expect(result.tipo).toBe('GENERICA');
      expect(result.confianca).toBeLessThan(0.5);
    });

    it('retorna GENERICA para mensagem vazia', () => {
      const result = classificarIntencao('');
      expect(result.tipo).toBe('GENERICA');
    });
  });
});
