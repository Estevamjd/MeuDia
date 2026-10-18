import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from '../metas.service';
import { metasRepository as metas } from '../../repositories';

vi.mock('../../repositories', () => ({
  metasRepository: { findAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), rpcGuardar: vi.fn() },
}));

beforeEach(() => vi.resetAllMocks());

describe('metas.service', () => {
  it('cria com nome aparado, ícone conhecido e data opcional', async () => {
    await service.criarMeta('u', { nome: '  Videogame ', valor_alvo: 3000, data_limite: '2027-01-31', icone: 'gamepad' });
    expect(metas.create).toHaveBeenCalledWith('u', { nome: 'Videogame', valor_alvo: 3000, data_limite: '2027-01-31', icone: 'gamepad' });
    await service.criarMeta('u', { nome: 'Sem data', valor_alvo: 10 });
    expect(metas.create).toHaveBeenLastCalledWith('u', { nome: 'Sem data', valor_alvo: 10 });
  });
  it.each([
    { nome: '', valor_alvo: 10 }, { nome: 'x'.repeat(81), valor_alvo: 10 }, { nome: 'X', valor_alvo: 0 },
    { nome: 'X', valor_alvo: 10, icone: 'nao-existe' }, { nome: 'X', valor_alvo: 10, data_limite: '31/01/2027' },
    { nome: 'X', valor_alvo: 10.001 },
  ])('valida %o', async (data) => {
    await expect(service.criarMeta('u', data)).rejects.toThrow();
    expect(metas.create).not.toHaveBeenCalled();
  });
  it('Guardei soma pela RPC (> 0); corrigir grava o valor absoluto (≥ 0)', async () => {
    await service.guardar('u', 'm', 500);
    expect(metas.rpcGuardar).toHaveBeenCalledWith('m', 500);
    await expect(service.guardar('u', 'm', 0)).rejects.toThrow();
    await service.atualizarMeta('u', 'm', { valor_guardado: 0 });
    expect(metas.update).toHaveBeenCalledWith('m', { valor_guardado: 0 }, 'u');
    await expect(service.atualizarMeta('u', 'm', { valor_guardado: -1 })).rejects.toThrow();
  });
  it('excluir e listar exigem usuário', async () => {
    await service.excluirMeta('u', 'm');
    expect(metas.remove).toHaveBeenCalledWith('m', 'u');
    await expect(service.listarMetas('')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
