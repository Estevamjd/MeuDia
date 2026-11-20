import { expect, it } from 'vitest';
import { confirmacao } from '../respostas';
import { interpretarPorRegras } from '../regras';

it.each(['Luz', 'Internet', 'Aluguel', 'Água', 'Cartão Nubank', 'IPTU 2026', 'Internet 5G', 'Ontem Bar'])('orientação segura para %s', (nome) => {
  const texto = confirmacao({ tipo: 'gasto', valor: 5, descricao: nome, categoria: 'Outros', pagar: true }, null, { conta_divergente: { descricao: nome, valor: 120 } });
  expect(texto).toContain('gasto separado');
  expect(texto).toContain('120,00 e continua pendente');
  expect(texto).toContain('"desfazer" (válido por 30 min)');
  if (['IPTU 2026', 'Internet 5G', 'Ontem Bar'].includes(nome)) {
    expect(texto).toContain('Contas a vencer → Paguei');
    expect(texto).not.toContain('"paguei ');
  } else {
    const frase = texto.match(/"(paguei [^"]+)"/)![1]!;
    expect(frase).toBe(`paguei ${nome.toLowerCase()}`);
    expect(interpretarPorRegras(frase, { hojeISO: '2026-11-20', horaSP: 12 })).toMatchObject({ tipo: 'gasto', pagar: true, valor: null, descricao: nome.charAt(0) + nome.slice(1).toLowerCase() });
  }
});
