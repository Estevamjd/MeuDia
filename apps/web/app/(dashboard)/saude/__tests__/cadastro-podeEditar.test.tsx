// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Review Codex front 2, SHOULD-FIX 3: o cadastro de saúde respeita `podeEditar`. Com o perfil carregando ou sem rede,
 * "Salvar e começar" fica desligado e nada é gravado (nem `profiles`, nem o peso de hoje, nem `perfil_saude`);
 * "Agora não" segue funcionando.
 */
const { perfilSaude, atualizarPerfil, registrarPeso, salvarCadastro, adiar, recarregar, consulta } = vi.hoisted(() => ({
  perfilSaude: { atual: {} as Record<string, unknown> },
  atualizarPerfil: vi.fn(async () => undefined),
  registrarPeso: vi.fn(async () => undefined),
  salvarCadastro: vi.fn(async () => null),
  adiar: vi.fn(),
  recarregar: vi.fn(),
  consulta: (data: unknown = undefined) => ({ data, isLoading: false, isError: false, refetch: () => undefined }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/saude' }));
vi.mock('../../../../components/saude/useRefeicoesCaderno', () => ({
  useRefeicoesCaderno: () => ({ query: consulta([]), entradas: [], onPonto: vi.fn(), ocupado: false, modais: null }),
}));
vi.mock('../../../../hooks', () => ({
  hojeLocal: () => '2026-11-19',
  usePerfilSaude: () => perfilSaude.atual,
  usePesoRecente: () => consulta([]),
  useProfile: () => consulta({ nome: 'Ana' }),
  useRegistrarPesoDoDia: () => ({ mutateAsync: registrarPeso, isPending: false }),
  useSessoesSemana: () => consulta([]),
  useTreinos: () => consulta([]),
  useUpdateProfile: () => ({ mutateAsync: atualizarPerfil, isPending: false }),
}));

import SaudeHojePage from '../page';

function irAteMetas() {
  fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '28' } });
  fireEvent.click(screen.getByRole('button', { name: 'Masculino' }));
  fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '175' } });
  fireEvent.change(screen.getByLabelText('Peso atual'), { target: { value: '70,0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(screen.getByRole('radio', { name: /Moderado/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Ganhar peso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver metas' }));
}

const base = { perfil: null, carregado: true, salvarCadastro, adiar, recarregar };

beforeEach(() => {
  for (const f of [atualizarPerfil, registrarPeso, salvarCadastro, adiar, recarregar]) f.mockClear();
});
afterEach(() => cleanup());

describe('cadastro de saúde x podeEditar', () => {
  it.each([
    ['sem rede (indisponivel)', 'indisponivel', /Sem conexão/],
    ['carregando (fonte null, com cache)', null, /Carregando seu perfil/],
  ])('%s: Salvar desligado, nada gravado; "Agora não" fecha', async (_nome, fonte, aviso) => {
    perfilSaude.atual = { ...base, fonte, podeEditar: false };
    render(<SaudeHojePage />);
    irAteMetas();
    const salvar = screen.getByRole('button', { name: 'Salvar e começar' }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    expect(screen.getByText(aviso)).toBeTruthy();
    fireEvent.click(salvar);
    await new Promise((r) => setTimeout(r, 10));
    expect(atualizarPerfil).not.toHaveBeenCalled();
    expect(registrarPeso).not.toHaveBeenCalled();
    expect(salvarCadastro).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(adiar).toHaveBeenCalledTimes(1);
  });

  it('sem rede: "tentar de novo" pede uma releitura', () => {
    perfilSaude.atual = { ...base, fonte: 'indisponivel', podeEditar: false };
    render(<SaudeHojePage />);
    irAteMetas();
    fireEvent.click(screen.getByRole('button', { name: 'tentar de novo' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('estado conhecido (podeEditar): Salvar grava profiles, o peso de hoje e o perfil', async () => {
    perfilSaude.atual = { ...base, fonte: 'ausente', podeEditar: true };
    render(<SaudeHojePage />);
    irAteMetas();
    const salvar = screen.getByRole('button', { name: 'Salvar e começar' }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(false);
    expect(screen.queryByText(/Sem conexão|Carregando seu perfil/)).toBeNull();
    fireEvent.click(salvar);
    await waitFor(() => expect(salvarCadastro).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Salvar e começar' }) as HTMLButtonElement).disabled).toBe(false));
    expect(atualizarPerfil).toHaveBeenCalledTimes(1);
    expect(registrarPeso).toHaveBeenCalledTimes(1);
  });
});
