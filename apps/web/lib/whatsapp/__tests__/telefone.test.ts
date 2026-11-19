import { describe, expect, it } from 'vitest';
import { numeroPermitido, telefoneDoPayload, variantesTelefone } from '../telefone';

describe('telefoneDoPayload', () => {
  it('lê o @c.us', () => expect(telefoneDoPayload({ from: '5511988887777@c.us' })).toBe('5511988887777'));
  it('@lid: usa o número alternativo do _data', () => {
    expect(telefoneDoPayload({ from: '123456789@lid', _data: { key: { remoteJidAlt: '5511988887777@s.whatsapp.net' } } })).toBe('5511988887777');
    expect(telefoneDoPayload({ from: '123@lid', _data: { Info: { SenderAlt: '5511988887777:12@s.whatsapp.net' } } })).toBe('5511988887777');
  });
  it('sem número reconhecível → null', () => expect(telefoneDoPayload({ from: '123@lid' })).toBeNull());
});

describe('lista de permitidos', () => {
  it('vazia ou ausente: ninguém', () => {
    expect(numeroPermitido('5511988887777', '')).toBe(false);
    expect(numeroPermitido('5511988887777', undefined)).toBe(false);
  });
  it('aceita com/sem o 9 e formatação livre', () => {
    expect(variantesTelefone('5511988887777')).toEqual(['5511988887777', '551188887777']);
    expect(numeroPermitido('551188887777', '+55 (11) 98888-7777, 5521999990000')).toBe(true);
    expect(numeroPermitido('5521999990000', '5511988887777;5521999990000')).toBe(true);
    expect(numeroPermitido('5531999990000', '5511988887777')).toBe(false);
  });
});
