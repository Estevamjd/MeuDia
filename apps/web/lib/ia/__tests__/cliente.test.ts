import { describe, expect, it } from 'vitest';
import { deveConsultarIA } from '../cliente';

describe('deveConsultarIA', () => {
  it.each(['como estão minhas finanças?', 'quanto gastei este mês?', 'abrir minhas notas', 'gastei quanto este mês?', 'paguei tudo este mês?', 'gastei 45?', 'gastei no mercado', 'paguei tudo este mês'])('%s fica nas regras', (texto) => {
    expect(deveConsultarIA(texto)).toBe(false);
  });
  it.each(['gastei 45 no mercado', 'paguei 12,50 de uber'])('%s consulta IA', (texto) => {
    expect(deveConsultarIA(texto)).toBe(true);
  });

  it.each(['almoço 32 reais', 'uber 18,90', 'R$ 50 mercado', 'r$50 farmácia', 'mercado 120', 'café 7.50', 'pizza 45 conto', 'recebi 100', 'lanche 20 no banco teste'])(
    'relato sem verbo, com valor: %s consulta IA',
    (texto) => {
      expect(deveConsultarIA(texto)).toBe(true);
    },
  );

  it.each([
    'Me dê uma dica de produtividade',
    'Adicione uma tarefa: comprar pão amanhã às 9h',
    'Adicione uma tarefa: comprar pão às 9h',
    'marcar reunião dia 15 às 10h',
    'dentista dia 20',
    'lembrar de pagar 50 reais',
    'treino 30 minutos',
    'academia 100 reais',
    'criar hábito de beber 2 litros de água',
    'beber 2 litros de água',
    'ler 10 páginas',
    'correr 5 km',
    'meditar 10 min',
    'tarefa 3',
    'almoço 14h30',
    'quanto gastei 32 reais hoje',
    'qual o saldo 50',
    'almoço 32 reais?',
  ])('não é relato de gasto: %s fica nas regras', (texto) => {
    expect(deveConsultarIA(texto)).toBe(false);
  });
});
