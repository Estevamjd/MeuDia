import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from '../cofrinho.service';
import { cofrinhoRepository as repo } from '../../repositories';

vi.mock('../../repositories', () => ({
  cofrinhoRepository: { rpcMover: vi.fn(), rpcCorrigir: vi.fn(), rpcFecharMes: vi.fn() },
}));

beforeEach(() => vi.resetAllMocks());

describe('cofrinho.service', () => {
  it('Guardar/Tirar: valida valor positivo com 2 casas e repassa a chave', async () => {
    await service.moverCofrinho('u', { tipo: 'guardar', valor: 50.1 }, 'k');
    expect(repo.rpcMover).toHaveBeenCalledWith('guardar', 50.1, 'k');
    await service.moverCofrinho('u', { tipo: 'tirar', valor: 0.07 }, 'k2');
    expect(repo.rpcMover).toHaveBeenLastCalledWith('tirar', 0.07, 'k2');
    await expect(service.moverCofrinho('u', { tipo: 'guardar', valor: 0 })).rejects.toThrow();
    await expect(service.moverCofrinho('u', { tipo: 'guardar', valor: 1.234 })).rejects.toThrow();
    await expect(service.moverCofrinho('u', { tipo: 'sobra', valor: 1 })).rejects.toThrow();
    await expect(service.moverCofrinho('', { tipo: 'guardar', valor: 1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('Corrigir: aceita zero, recusa negativo', async () => {
    await service.corrigirCofrinho('u', { valor_real: 0 }, 'k');
    expect(repo.rpcCorrigir).toHaveBeenCalledWith(0, 'k');
    await expect(service.corrigirCofrinho('u', { valor_real: -1 })).rejects.toThrow();
  });
  it('Fechar mês: Guardar exige valor; Agora não manda null', async () => {
    await service.fecharMesCofrinho('u', { competencia: '2026-11', guardar: true, valor: 99 });
    expect(repo.rpcFecharMes).toHaveBeenCalledWith('2026-11', true, 99);
    await service.fecharMesCofrinho('u', { competencia: '2026-11', guardar: false });
    expect(repo.rpcFecharMes).toHaveBeenLastCalledWith('2026-11', false, null);
    await expect(service.fecharMesCofrinho('u', { competencia: '2026-11', guardar: true })).rejects.toThrow();
    await expect(service.fecharMesCofrinho('u', { competencia: '2026-13', guardar: false })).rejects.toThrow();
  });
});
