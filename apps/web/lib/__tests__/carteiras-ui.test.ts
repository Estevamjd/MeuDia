import { describe, expect, it } from 'vitest';
import { BANCO_EXCLUIDO, detalheExclusaoCarteira, detalheExclusaoTransferencia, rotuloTransferencia } from '../carteiras-ui';

const nomes = new Map([['a', 'Nubank'], ['b', 'Caixa']]);

describe('transferência com banco excluído (007)', () => {
  it('rótulo "de → para", com "banco excluído" no lado NULL', () => {
    expect(rotuloTransferencia({ origem_id: 'a', destino_id: 'b' }, nomes)).toBe('Nubank → Caixa');
    expect(rotuloTransferencia({ origem_id: null, destino_id: 'b' }, nomes)).toBe(`${BANCO_EXCLUIDO} → Caixa`);
    expect(rotuloTransferencia({ origem_id: 'a', destino_id: null }, nomes)).toBe(`Nubank → ${BANCO_EXCLUIDO}`);
  });
  it('confirmação diz que os bancos voltam ao saldo anterior', () => {
    expect(detalheExclusaoTransferencia({ origem_id: 'a', destino_id: 'b' })).toBe('Os dois bancos voltam ao saldo de antes da transferência.');
    expect(detalheExclusaoTransferencia({ origem_id: null, destino_id: 'b' })).toBe('O banco que sobrou volta ao saldo de antes da transferência.');
  });
});

describe('excluir banco', () => {
  it('explica "Sem banco", saldo dos outros e o estado sem nenhum banco', () => {
    expect(detalheExclusaoCarteira('Nubank', false)).toBe(
      'Os lançamentos de Nubank ficam como "Sem banco" e o saldo dos outros bancos não muda. Transferências com ele ficam como "banco excluído".',
    );
    expect(detalheExclusaoCarteira('Nubank', true)).toContain('É o seu último banco: o Cofrinho volta a pedir onde fica seu dinheiro.');
  });
});
