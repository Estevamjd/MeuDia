import type { Objetivo, Profile } from '@meudia/shared';

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

/** `null` = linha de perfil inexistente (precisa de onboarding); `undefined` = ainda não carregado. */
export function precisaOnboarding(profile: Profile | null | undefined): boolean {
  if (profile === undefined) return false;
  return profile === null || !profile.onboarding_feito;
}

/**
 * O layout só manda para o onboarding com dados buscados após a montagem — nunca com o cache
 * antigo (que ainda pode ter `onboarding_feito=false` logo depois de concluir).
 */
export function deveRedirecionarOnboarding(estado: {
  authLoading: boolean;
  temUsuario: boolean;
  profile: Profile | null | undefined;
  isFetching: boolean;
  isFetchedAfterMount: boolean;
}): boolean {
  const { authLoading, temUsuario, profile, isFetching, isFetchedAfterMount } = estado;
  if (authLoading || !temUsuario || isFetching || !isFetchedAfterMount) return false;
  return precisaOnboarding(profile);
}

export interface DadosOnboarding {
  nome: string;
  objetivo: Objetivo | null;
  peso_atual: string;
  altura: string;
  meta_peso: string;
  meta_calorias: number;
}

export type PerfilOnboarding = Partial<Omit<Profile, 'created_at'>> & {
  id: string;
  onboarding_feito: true;
};

const numeroOuNull = (valor: string) => (valor ? parseFloat(valor) : null);

/**
 * Payload do upsert (cria a linha se faltar; RLS permite insert com id = auth.uid()).
 * `pular` grava só a conclusão; o modo Finanças não envia campos de saúde.
 */
export function montarPerfilOnboarding(
  user: { id: string; email?: string | null },
  dados: DadosOnboarding,
  opcoes: { modoFinancas: boolean; pular: boolean },
): PerfilOnboarding {
  const perfil: PerfilOnboarding = { id: user.id, onboarding_feito: true };
  if (user.email) perfil.email = user.email;
  if (opcoes.pular) return perfil;

  const nome = dados.nome.trim();
  if (nome) perfil.nome = nome;
  if (opcoes.modoFinancas) return perfil;

  return {
    ...perfil,
    objetivo: dados.objetivo,
    peso_atual: numeroOuNull(dados.peso_atual),
    altura: numeroOuNull(dados.altura),
    meta_peso: numeroOuNull(dados.meta_peso),
    meta_calorias: dados.meta_calorias,
  };
}

/** Atualização otimista do cache `['profile', id]`; funciona também sem perfil em cache. */
export function aplicarOnboardingNoCache(
  old: Profile | null | undefined,
  perfil: PerfilOnboarding,
): Profile {
  return { ...(old ?? {}), ...perfil } as Profile;
}

export const MENSAGEM_ERRO_ONBOARDING =
  'Não foi possível salvar. Verifique sua conexão e tente novamente.';

/** Linhas do passo "Onde fica seu dinheiro?" → carteiras a criar (sem nome = ignorada). */
export function montarCarteirasOnboarding(
  linhas: readonly { id?: string; negativo?: boolean; nome: string; digitos: string }[],
): { id: string; indice: number; carteira: { nome: string; tipo: 'banco' | 'dinheiro' | 'poupanca'; saldo_inicial: number; ordem: number } }[] {
  return linhas.flatMap((l, indice) => {
    const nome = l.nome.trim().slice(0, 60);
    if (!nome) return [];
    const digitos = l.digitos.replace(/\D/g, '');
    const tipo = /carteira|dinheiro|esp[eé]cie/i.test(nome) ? 'dinheiro' : /poupan[cç]a/i.test(nome) ? 'poupanca' : 'banco';
    return [{ id: l.id ?? String(indice), indice, carteira: { nome, tipo, saldo_inicial: digitos ? Number(digitos) / 100 * (l.negativo || l.digitos.includes('-') ? -1 : 1) : 0, ordem: indice } }];
  });
}
