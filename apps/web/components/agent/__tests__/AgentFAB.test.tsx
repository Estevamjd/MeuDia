// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppModeProvider } from '../../AppModeProvider';
import type { AppMode } from '../../../lib/app-mode';
import { AgentFAB } from '../AgentFAB';

/** P0.1: no modo Finanças o FAB fica escondido no celular (`hidden md:flex`) e fazia polling de 60s mesmo assim. */
const { useContarNaoLidas } = vi.hoisted(() => ({ useContarNaoLidas: vi.fn(() => ({ data: 3 })) }));
vi.mock('../../../hooks/useAgente', () => ({ useContarNaoLidas }));

const telaMd = (md: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: md, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

const montar = (mode: AppMode) =>
  render(
    <AppModeProvider mode={mode} vapidPublicKey={null}>
      <AgentFAB onClick={vi.fn()} />
    </AppModeProvider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useContarNaoLidas.mockClear();
});

describe('AgentFAB: contador de não lidas', () => {
  it('padrão: mantém o polling de 60s (opções padrão do hook) e mostra o badge', () => {
    telaMd(false);
    montar('padrao');
    expect(useContarNaoLidas.mock.calls.every((c: unknown[]) => c[0] === undefined)).toBe(true);
    expect(screen.getByRole('button', { name: 'Abrir agente IA' }).textContent).toBe('3');
  });

  it('finanças no celular (FAB escondido): não consulta nem faz polling', () => {
    telaMd(false);
    montar('financas');
    expect(useContarNaoLidas).toHaveBeenCalled();
    for (const [op] of useContarNaoLidas.mock.calls as unknown[][]) expect(op).toEqual({ enabled: false, poll: false });
  });

  it('finanças no desktop (FAB visível): consulta sem polling', () => {
    telaMd(true);
    montar('financas');
    for (const [op] of useContarNaoLidas.mock.calls as unknown[][]) expect(op).toEqual({ enabled: true, poll: false });
  });
});
