import { describe, expect, it } from 'vitest';
import { deveConsultarIA } from '../cliente';

describe('deveConsultarIA', () => {
  it.each(['como estão minhas finanças?', 'quanto gastei este mês?', 'abrir minhas notas', 'gastei quanto este mês?', 'paguei tudo este mês?', 'gastei 45?', 'gastei no mercado', 'paguei tudo este mês'])('%s fica nas regras', (texto) => {
    expect(deveConsultarIA(texto)).toBe(false);
  });
  it.each(['gastei 45 no mercado', 'paguei 12,50 de uber'])('%s consulta IA', (texto) => {
    expect(deveConsultarIA(texto)).toBe(true);
  });
});
