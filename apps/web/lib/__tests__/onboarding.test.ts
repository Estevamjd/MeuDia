import { describe, it, expect } from 'vitest';
import type { Profile } from '@meudia/shared';
import {
  aplicarOnboardingNoCache,
  deveRedirecionarOnboarding,
  montarCarteirasOnboarding,
  montarPerfilOnboarding,
  precisaOnboarding,
  profileKey,
} from '../onboarding';

const perfil = (onboarding_feito: boolean) => ({ id: 'u1', nome: 'Ana', onboarding_feito }) as Profile;

const dados = {
  nome: '  Ana  ',
  objetivo: 'emagrecer' as const,
  peso_atual: '70.5',
  altura: '',
  meta_peso: '65',
  meta_calorias: 1800,
};

const user = { id: 'u1', email: 'ana@exemplo.com' };

describe('profileKey', () => {
  it('é a mesma chave usada pelo useProfile', () => {
    expect(profileKey('u1')).toEqual(['profile', 'u1']);
  });
});

describe('precisaOnboarding', () => {
  it('perfil inexistente (null) precisa de onboarding', () => {
    expect(precisaOnboarding(null)).toBe(true);
  });

  it('não decide enquanto o perfil não carregou', () => {
    expect(precisaOnboarding(undefined)).toBe(false);
  });

  it('segue o onboarding_feito', () => {
    expect(precisaOnboarding(perfil(false))).toBe(true);
    expect(precisaOnboarding(perfil(true))).toBe(false);
  });
});

describe('deveRedirecionarOnboarding', () => {
  const base = {
    authLoading: false,
    temUsuario: true,
    profile: perfil(false) as Profile | null | undefined,
    isFetching: false,
    isFetchedAfterMount: true,
  };

  it('redireciona com perfil buscado após a montagem e onboarding pendente', () => {
    expect(deveRedirecionarOnboarding(base)).toBe(true);
  });

  it('redireciona quando o perfil não existe', () => {
    expect(deveRedirecionarOnboarding({ ...base, profile: null })).toBe(true);
  });

  it('não redireciona com cache antigo (ainda não buscado após montar)', () => {
    expect(deveRedirecionarOnboarding({ ...base, isFetchedAfterMount: false })).toBe(false);
  });

  it('não redireciona enquanto rebusca', () => {
    expect(deveRedirecionarOnboarding({ ...base, isFetching: true })).toBe(false);
  });

  it('não redireciona sem usuário, com auth carregando ou onboarding feito', () => {
    expect(deveRedirecionarOnboarding({ ...base, temUsuario: false })).toBe(false);
    expect(deveRedirecionarOnboarding({ ...base, authLoading: true })).toBe(false);
    expect(deveRedirecionarOnboarding({ ...base, profile: perfil(true) })).toBe(false);
    expect(deveRedirecionarOnboarding({ ...base, profile: undefined })).toBe(false);
  });
});

describe('montarPerfilOnboarding', () => {
  it('modo Finanças: id, email, nome e conclusão, sem campos de saúde', () => {
    expect(montarPerfilOnboarding(user, dados, { modoFinancas: true, pular: false })).toEqual({
      id: 'u1',
      email: 'ana@exemplo.com',
      nome: 'Ana',
      onboarding_feito: true,
    });
  });

  it('modo padrão inclui os campos de saúde', () => {
    expect(montarPerfilOnboarding(user, dados, { modoFinancas: false, pular: false })).toEqual({
      id: 'u1',
      email: 'ana@exemplo.com',
      nome: 'Ana',
      onboarding_feito: true,
      objetivo: 'emagrecer',
      peso_atual: 70.5,
      altura: null,
      meta_peso: 65,
      meta_calorias: 1800,
    });
  });

  it('pular grava só a conclusão (não sobrescreve nome nem saúde)', () => {
    expect(montarPerfilOnboarding(user, dados, { modoFinancas: false, pular: true })).toEqual({
      id: 'u1',
      email: 'ana@exemplo.com',
      onboarding_feito: true,
    });
  });

  it('omite nome vazio e email ausente', () => {
    const perfilMontado = montarPerfilOnboarding(
      { id: 'u1' },
      { ...dados, nome: '   ' },
      { modoFinancas: true, pular: false },
    );
    expect(perfilMontado).toEqual({ id: 'u1', onboarding_feito: true });
    expect(perfilMontado).not.toHaveProperty('nome');
    expect(perfilMontado).not.toHaveProperty('email');
  });
});

describe('aplicarOnboardingNoCache', () => {
  it('marca o perfil em cache como concluído, preservando os demais campos', () => {
    const old = { ...perfil(false), meta_agua: 8 };
    const novo = aplicarOnboardingNoCache(old, { id: 'u1', nome: 'Bia', onboarding_feito: true });
    expect(novo).toMatchObject({ id: 'u1', nome: 'Bia', meta_agua: 8, onboarding_feito: true });
    expect(precisaOnboarding(novo)).toBe(false);
  });

  it('cria o perfil no cache quando estava ausente (null)', () => {
    const novo = aplicarOnboardingNoCache(null, { id: 'u1', onboarding_feito: true });
    expect(novo).toEqual({ id: 'u1', onboarding_feito: true });
    expect(precisaOnboarding(novo)).toBe(false);
  });
});

it('linha sem id ganha UUID (nunca o índice, que quebraria com 22P02 no banco)', () => {
  const [a, b] = montarCarteirasOnboarding([{ nome: 'Nu', digitos: '' }, { nome: 'Caixa', digitos: '' }]);
  expect(a!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(b!.id).not.toBe(a!.id);
  expect(montarCarteirasOnboarding([{ id: 'fixo', nome: 'Nu', digitos: '' }])[0]!.id).toBe('fixo');
});
