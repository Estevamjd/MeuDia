// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { calcularMetas, recalcularMetas } from '@meudia/shared';
import { BancoFalso } from '../../lib/__tests__/perfil-saude-banco-falso';
import { lerPerfilSaude, perfilParaRow, perfilVazio } from '../../lib/perfil-saude';

/** Wave 2B (review Codex 2, 4 e 6): sincronização do perfil de saúde no hook. */
const { banco } = vi.hoisted(() => ({ banco: { atual: null as unknown as BancoFalso } }));
vi.mock('@meudia/api', () => ({ getSupabase: () => banco.atual.client }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { TEMPO_LIMITE_ADIAR_MS, chavePerfilSaude, usePerfilSaude } from '../usePerfilSaude';

const respostas = { idade: 28, sexo: 'masculino' as const, alturaCm: 175, pesoKg: 70, nivel: 'moderado' as const, objetivo: 'ganhar' as const };
const metas = recalcularMetas(null, calcularMetas(respostas));
const completo = { ...perfilVazio('respondido'), respostas, metas, prazoMeta: '2027-03-01' };

let cliente: QueryClient;
function montar() {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return renderHook(() => usePerfilSaude(), { wrapper });
}

beforeEach(() => {
  banco.atual = new BancoFalso();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe('carga e edição', () => {
  it('aparelho novo com leitura lenta: sem perfil e sem edição até a carga; depois mostra a conta e edita só o ritmo', async () => {
    banco.atual.semear('u1', perfilParaRow('u1', completo));
    const abrir = banco.atual.portao('select');
    const { result } = montar();
    await waitFor(() => expect(banco.atual.ops()).toEqual(['select']));
    expect(result.current).toMatchObject({ perfil: null, carregado: false, podeEditar: false });
    abrir();
    await waitFor(() => expect(result.current.podeEditar).toBe(true));
    expect(result.current.perfil?.metas?.kcal).toBe(3102);
    await act(() => result.current.atualizar({ ritmoPct: 0.25 }));
    expect(banco.atual.chamadas.at(-1)).toEqual({ op: 'update', corpo: { ritmo_pct: 0.25 }, filtro: ['user_id', 'u1'] });
    expect(banco.atual.linhas.get('u1')).toMatchObject({ respostas, metas, prazo_meta: '2027-03-01', ritmo_pct: 0.25 });
  });

  it('sem rede na carga: mostra o cache, mas só leitura (podeEditar falso) e nada é gravado', async () => {
    localStorage.setItem('meudia:saude:v1:u1', JSON.stringify(completo));
    banco.atual.falhas.select = 'rede';
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('indisponivel'));
    expect(result.current).toMatchObject({ carregado: true, podeEditar: false, perfil: { metas: { kcal: 3102 } } });
    expect(banco.atual.ops()).toEqual(['select']);
  });

  it('carga atrasada (refetch) não sobrescreve o cadastro salvo: nem o banco, nem o cache, nem a tela', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('ausente'));
    // Perfil antigo aparece no aparelho (outra aba) e uma recarga começa e fica presa na leitura.
    localStorage.setItem('meudia:saude:v1:u1', JSON.stringify(perfilVazio('adiado')));
    const abrir = banco.atual.portao('select');
    void cliente.invalidateQueries({ queryKey: chavePerfilSaude('u1') });
    await waitFor(() => expect(banco.atual.ops()).toEqual(['select', 'select']));
    let salvar!: Promise<unknown>;
    act(() => {
      salvar = result.current.salvarCadastro(respostas, metas);
    });
    abrir();
    await act(() => salvar);
    // A recarga foi cancelada: não migrou o 'adiado' antigo; o cadastro foi o único a gravar.
    expect(banco.atual.ops()).toEqual(['select', 'select', 'upsert']);
    expect(banco.atual.linhas.get('u1')).toMatchObject({ estado: 'respondido', respostas, metas });
    expect(lerPerfilSaude('u1')?.estado).toBe('respondido');
    await waitFor(() => expect(result.current.perfil?.estado).toBe('respondido'));
  });
});

describe('"Agora não" (adiar)', () => {
  it('fecha na hora, guarda no aparelho e cria a linha uma vez só, mesmo com upsert que nunca responde e vários toques', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('ausente'));
    expect(result.current.perfil).toBeNull();
    banco.atual.portao('upsert'); // nunca abre
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => {
      result.current.adiar();
      result.current.adiar();
      result.current.adiar();
    });
    expect(result.current.perfil?.estado).toBe('adiado');
    expect(lerPerfilSaude('u1')?.estado).toBe('adiado');
    await vi.advanceTimersByTimeAsync(0);
    expect(banco.atual.ops()).toEqual(['select', 'upsert']);
    // Tempo limite: a fila anda e um salvar depois funciona.
    await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_ADIAR_MS + 1);
    vi.useRealTimers();
    delete banco.atual.portoes.upsert;
    await act(() => result.current.salvarCadastro(respostas, metas));
    expect(banco.atual.linhas.get('u1')).toMatchObject({ estado: 'respondido' });
    expect(result.current.perfil?.estado).toBe('respondido');
  });

  it('com a linha criada por outro aparelho no meio tempo: o insert-only não a sobrescreve e a tela passa a mostrar a conta', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('ausente'));
    banco.atual.semear('u1', perfilParaRow('u1', completo));
    const antes = structuredClone(banco.atual.linhas.get('u1'));
    act(() => result.current.adiar());
    await waitFor(() => expect(result.current.fonte).toBe('conta'));
    expect(banco.atual.linhas.get('u1')).toEqual(antes);
    expect(result.current.perfil?.estado).toBe('respondido');
  });

  it('sem rede na carga: só no aparelho, nenhuma gravação na conta', async () => {
    banco.atual.falhas.select = 'rede';
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('indisponivel'));
    act(() => result.current.adiar());
    expect(result.current.perfil?.estado).toBe('adiado');
    await new Promise((r) => setTimeout(r, 20));
    expect(banco.atual.ops()).toEqual(['select']);
  });
});

describe('sem rede e volta da rede (review Codex front 2: SHOULD-FIX 1 e 2)', () => {
  it('aparelho já offline e sem cache: a carga termina na hora como só leitura (sem esqueleto), sem gravar; "Agora não" funciona', async () => {
    onlineManager.setOnline(false);
    const { result } = montar();
    await waitFor(() => expect(result.current.carregado).toBe(true));
    expect(result.current).toMatchObject({ fonte: 'indisponivel', podeEditar: false, perfil: null });
    expect(banco.atual.ops()).toEqual([]);
    act(() => result.current.adiar());
    expect(result.current.perfil?.estado).toBe('adiado');
    await new Promise((r) => setTimeout(r, 20));
    expect(banco.atual.ops()).toEqual([]);
    // A rede volta: relê uma vez, sai do só leitura, e o 'adiado' do aparelho sobe por insert-only.
    onlineManager.setOnline(true);
    await waitFor(() => expect(result.current.podeEditar).toBe(true));
    expect(banco.atual.ops().filter((o) => o === 'select').length).toBeGreaterThanOrEqual(1);
  });

  it('leitura que falha por rede: com a rede de volta, relê uma vez só, religa os controles e não mexe na linha', async () => {
    banco.atual.semear('u1', perfilParaRow('u1', completo));
    const antes = structuredClone(banco.atual.linhas.get('u1'));
    banco.atual.falhas.select = 'rede';
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('indisponivel'));
    expect(result.current.podeEditar).toBe(false);
    delete banco.atual.falhas.select;
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await waitFor(() => expect(result.current.podeEditar).toBe(true));
    expect(result.current.fonte).toBe('conta');
    await new Promise((r) => setTimeout(r, 20));
    expect(banco.atual.ops()).toEqual(['select', 'select']);
    expect(banco.atual.linhas.get('u1')).toEqual(antes);
  });

  it('estado conhecido segue fresco: a volta da rede não relê (sem laço de requisições)', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('ausente'));
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(banco.atual.ops()).toEqual(['select']);
  });

  it('erro do servidor com o navegador online: "Tentar de novo" (recarregar) relê uma vez e religa os controles', async () => {
    banco.atual.falhas.select = 'rede';
    const { result } = montar();
    await waitFor(() => expect(result.current.fonte).toBe('indisponivel'));
    delete banco.atual.falhas.select;
    act(() => result.current.recarregar());
    await waitFor(() => expect(result.current.podeEditar).toBe(true));
    expect(banco.atual.ops()).toEqual(['select', 'select']);
  });
});
