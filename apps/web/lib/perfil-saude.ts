import type { MetasSaude, ObjetivoSaude, Profile, ProfileUpdate, RespostasSaude } from '@meudia/shared';
import { FORMULA_SAUDE_VERSAO, GANHO_SEMANAL_MEIO_PCT, RITMOS_SEMANAIS_PCT } from '@meudia/shared';

/**
 * Perfil de saúde sem a migration 009 (`perfil_saude` ainda não existe no banco).
 * - Vai para `profiles` (colunas que já existem): peso_atual, altura (em metros), meta_calorias, meta_peso, objetivo.
 * - Fica só neste aparelho (localStorage, uma chave por conta): idade, sexo, nível de atividade, origem das metas
 *   ("calculada" / "definida por você"), faixa de proteína, prazo do peso-meta e ritmo semanal.
 * Quando a 009 entrar, este arquivo vira a leitura/gravação de `perfil_saude` e o local some.
 * Nada daqui vai para log (dado de saúde).
 */

export interface PerfilSaude {
  versao: 1;
  /** 'adiado' = tocou em "Agora não": usa o módulo sem metas calculadas e o cadastro não abre sozinho. */
  estado: 'respondido' | 'adiado';
  respostas: RespostasSaude | null;
  metas: MetasSaude | null;
  /** Data limite do peso-meta ('AAAA-MM-DD'). O peso-meta em si fica em profiles.meta_peso. */
  prazoMeta: string | null;
  ritmoPct: number;
  formulaVersao: string;
  atualizadoEm: string;
}

export const MENSAGEM_ERRO_CADASTRO_SAUDE = 'Não deu para salvar na sua conta. Confira a conexão e toque em Salvar de novo.';

const chave = (userId: string) => `meudia:saude:v1:${userId}`;
export const EVENTO_PERFIL_SAUDE = 'meudia:perfil-saude';

function armazenamento(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function perfilVazio(estado: PerfilSaude['estado'] = 'adiado'): PerfilSaude {
  return {
    versao: 1,
    estado,
    respostas: null,
    metas: null,
    prazoMeta: null,
    ritmoPct: GANHO_SEMANAL_MEIO_PCT,
    formulaVersao: FORMULA_SAUDE_VERSAO,
    atualizadoEm: new Date().toISOString(),
  };
}

/** null = nunca respondeu nem adiou (abre o cadastro na primeira visita a /saude). Dado corrompido também é null. */
export function lerPerfilSaude(userId: string, storage: Storage | null = armazenamento()): PerfilSaude | null {
  if (!storage) return null;
  try {
    const bruto = storage.getItem(chave(userId));
    if (!bruto) return null;
    const p = JSON.parse(bruto) as Partial<PerfilSaude>;
    if (p.versao !== 1 || (p.estado !== 'respondido' && p.estado !== 'adiado')) return null;
    return {
      ...perfilVazio(p.estado),
      ...p,
      ritmoPct: RITMOS_SEMANAIS_PCT.includes(p.ritmoPct as never) ? (p.ritmoPct as number) : GANHO_SEMANAL_MEIO_PCT,
    };
  } catch {
    return null;
  }
}

export function salvarPerfilSaude(userId: string, perfil: PerfilSaude, storage: Storage | null = armazenamento()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(chave(userId), JSON.stringify({ ...perfil, atualizadoEm: new Date().toISOString() }));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PERFIL_SAUDE));
    return true;
  } catch {
    return false;
  }
}

const OBJETIVO_PROFILE: Record<ObjetivoSaude, NonNullable<Profile['objetivo']>> = {
  ganhar: 'ganhar_massa',
  manter: 'saude_geral',
};

/** O que do cadastro de saúde cabe em `profiles` hoje. altura em metros (CHECK do validador: 0,5–2,5). */
export function paraProfile(respostas: RespostasSaude, metas: MetasSaude): ProfileUpdate {
  return {
    peso_atual: respostas.pesoKg,
    altura: Math.round(respostas.alturaCm) / 100,
    meta_calorias: metas.kcal,
    objetivo: OBJETIVO_PROFILE[respostas.objetivo],
  };
}

/** Pré-preenche o cadastro de quem já tem conta (profiles + último peso). */
export function respostasIniciais(profile: Profile | null | undefined, ultimoPesoKg: number | null): Partial<RespostasSaude> {
  const alturaM = profile?.altura ? Number(profile.altura) : null;
  return {
    pesoKg: ultimoPesoKg ?? (profile?.peso_atual ? Number(profile.peso_atual) : undefined),
    alturaCm: alturaM ? Math.round(alturaM * 100) : undefined,
    objetivo: profile?.objetivo === 'ganhar_massa' ? 'ganhar' : undefined,
  };
}
