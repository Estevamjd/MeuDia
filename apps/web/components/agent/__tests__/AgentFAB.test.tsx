// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppModeProvider } from '../../AppModeProvider';
import type { AppMode } from '../../../lib/app-mode';
import { AgentFAB } from '../AgentFAB';

/**
 * P0.1: o FAB fica escondido no celular (`hidden md:flex`) e fazia polling de 60s mesmo assim. Desde a faxina dos
 * módulos legados o modo padrão segue a mesma regra (sem polling, só conta com o FAB visível).
 */
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
  it.each(['financas', 'padrao'] as const)('%s no celular (FAB escondido): não consulta nem faz polling', (mode) => {
    telaMd(false);
    montar(mode);
    expect(useContarNaoLidas).toHaveBeenCalled();
    for (const [op] of useContarNaoLidas.mock.calls as unknown[][]) expect(op).toEqual({ enabled: false, poll: false });
  });

  it.each(['financas', 'padrao'] as const)('%s no desktop (FAB visível): consulta sem polling e mostra o badge', (mode) => {
    telaMd(true);
    montar(mode);
    for (const [op] of useContarNaoLidas.mock.calls as unknown[][]) expect(op).toEqual({ enabled: true, poll: false });
    expect(screen.getByRole('button', { name: 'Abrir agente IA' }).textContent).toBe('3');
  });
});
