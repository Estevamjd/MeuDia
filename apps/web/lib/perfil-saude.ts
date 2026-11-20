import type { MetasSaude, ObjetivoSaude, Profile, ProfileUpdate, RespostasSaude } from '@meudia/shared';
import { FORMULA_SAUDE_VERSAO, GANHO_SEMANAL_MEIO_PCT, RITMOS_SEMANAIS_PCT } from '@meudia/shared';

/**
 * Perfil de saúde (1 linha por pessoa em `public.perfil_saude`, migração 016).
 * - Fonte da verdade: a linha da conta (RLS `auth.uid() = user_id`). Existindo a linha, ela vence sempre;
 *   nenhuma decisão usa o relógio do aparelho.
 * - localStorage (`meudia:saude:v1:<userId>`) é só cache para mostrar algo antes da carga e o modo sem a 016.
 * - Migração do perfil antigo (só no aparelho): INSERT ... ON CONFLICT DO NOTHING e relê; vale o que o banco tiver.
 * - Edição grava só as colunas mudadas (UPDATE ... eq user_id). Linha inteira só no cadastro ("Salvar e começar")
 *   ou na criação quando a ausência foi confirmada (leitura com sucesso e sem linha), sempre por insert-only.
 * - Estados da carga (`FontePerfil`): 'conta' (linha), 'ausente' (confirmado sem linha), 'sem_tabela' (016 não
 *   aplicada: só o aparelho) e 'indisponivel' (sem rede/erro: só leitura do cache, nada é gravado; tenta de novo).
 *   Edição offline não existe (opção mais simples e segura): sem estado conhecido, os controles ficam desligados.
 * - `profiles` continua recebendo peso_atual, altura (metros), meta_calorias e objetivo (`paraProfile`).
 * Nada daqui vai para log nem para o Sentry (dado de saúde): erros viram resultado, nunca mensagem com o conteúdo.
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
  /** ISO. Remoto = `updated_at` (só informativo: nunca decide quem vence). */
  atualizadoEm: string;
}

export const MENSAGEM_ERRO_CADASTRO_SAUDE = 'Não deu para salvar na sua conta. Confira a conexão e toque em Salvar de novo.';

const chave = (userId: string) => `meudia:saude:v1:${userId}`;
export const EVENTO_PERFIL_SAUDE = 'meudia:perfil-saude';
export const TABELA_PERFIL_SAUDE = 'perfil_saude';

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

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const dataValida = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Valida e completa um perfil vindo do cache ou do banco. Inválido = null. */
function normalizar(p: Partial<PerfilSaude> & Record<string, unknown>): PerfilSaude | null {
  if (p.estado !== 'respondido' && p.estado !== 'adiado') return null;
  const ritmo = Number(p.ritmoPct);
  return {
    ...perfilVazio(p.estado),
    respostas: objeto(p.respostas) ? (p.respostas as unknown as RespostasSaude) : null,
    metas: objeto(p.metas) ? (p.metas as unknown as MetasSaude) : null,
    prazoMeta: dataValida(p.prazoMeta) ? p.prazoMeta : null,
    ritmoPct: RITMOS_SEMANAIS_PCT.includes(ritmo as never) ? ritmo : GANHO_SEMANAL_MEIO_PCT,
    formulaVersao: typeof p.formulaVersao === 'string' && p.formulaVersao ? p.formulaVersao : FORMULA_SAUDE_VERSAO,
    atualizadoEm: typeof p.atualizadoEm === 'string' && !Number.isNaN(Date.parse(p.atualizadoEm)) ? p.atualizadoEm : new Date(0).toISOString(),
  };
}

// ─── Cache local ────────────────────────────────────────────────────────────

/** Cache deste aparelho. null = nada guardado (ou corrompido / de outra versão). */
export function lerPerfilSaude(userId: string, storage: Storage | null = armazenamento()): PerfilSaude | null {
  if (!storage) return null;
  try {
    const bruto = storage.getItem(chave(userId));
    if (!bruto) return null;
    const p = JSON.parse(bruto) as Partial<PerfilSaude> & Record<string, unknown>;
    if (!objeto(p) || p.versao !== 1) return null;
    return normalizar(p);
  } catch {
    return null;
  }
}

/** Grava o perfil no cache como veio. */
export function guardarPerfilSaudeLocal(userId: string, perfil: PerfilSaude, storage: Storage | null = armazenamento()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(chave(userId), JSON.stringify(perfil));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PERFIL_SAUDE));
    return true;
  } catch {
    return false;
  }
}

// ─── Remoto (public.perfil_saude, contrato da 016) ──────────────────────────

export interface PerfilSaudeRow {
  user_id: string;
  estado: 'respondido' | 'adiado';
  respostas: RespostasSaude | null;
  metas: MetasSaude | null;
  prazo_meta: string | null;
  ritmo_pct: number | string;
  formula_versao: string;
  created_at?: string;
  updated_at: string;
}

export const COLUNAS_PERFIL_SAUDE = 'user_id, estado, respostas, metas, prazo_meta, ritmo_pct, formula_versao, updated_at';

export function perfilParaRow(userId: string, p: PerfilSaude): Omit<PerfilSaudeRow, 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    estado: p.estado,
    respostas: p.respostas,
    metas: p.metas,
    prazo_meta: p.prazoMeta,
    ritmo_pct: p.ritmoPct,
    formula_versao: p.formulaVersao || FORMULA_SAUDE_VERSAO,
  };
}

export function rowParaPerfil(r: PerfilSaudeRow): PerfilSaude | null {
  return normalizar({
    versao: 1,
    estado: r.estado,
    respostas: r.respostas,
    metas: r.metas,
    prazoMeta: r.prazo_meta,
    ritmoPct: Number(r.ritmo_pct),
    formulaVersao: r.formula_versao,
    atualizadoEm: r.updated_at,
  });
}

/** Cliente mínimo (o do Supabase serve); facilita o teste sem rede. */
export interface ClientePerfilSaude {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(tabela: string): any;
}

interface ErroPostgrest {
  code?: string;
  message?: string;
}

/** Tabela ainda não existe (016 não aplicada): PostgREST PGRST205, Postgres 42P01 ou HTTP 404. */
export function tabelaAusente(error: ErroPostgrest | null | undefined, status?: number): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01' || (!!error && status === 404);
}

export type ResultadoRemoto =
  | { tipo: 'ok'; perfil: PerfilSaude | null }
  | { tipo: 'sem_tabela' }
  | { tipo: 'falha' };

/** Carga/operação cancelada (a query foi cancelada ou passou do tempo): nenhum efeito colateral depois disso. */
export class OperacaoCancelada extends Error {
  constructor() {
    super('cancelada');
    this.name = 'AbortError';
  }
}
function conferir(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new OperacaoCancelada();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comSinal = (q: any, signal: AbortSignal | undefined) => (signal && typeof q.abortSignal === 'function' ? q.abortSignal(signal) : q);

type RespostaPg = { data: unknown; error: ErroPostgrest | null; status?: number };

/** Linha única de uma resposta em lista (gravações usam lista: 0 linhas não é erro). */
function primeiraLinha({ data, error, status }: RespostaPg): ResultadoRemoto {
  if (error) return tabelaAusente(error, status) ? { tipo: 'sem_tabela' } : { tipo: 'falha' };
  const linha = Array.isArray(data) ? data[0] : data;
  return { tipo: 'ok', perfil: linha ? rowParaPerfil(linha as PerfilSaudeRow) : null };
}

export async function carregarPerfilSaudeRemoto(client: ClientePerfilSaude, userId: string, signal?: AbortSignal): Promise<ResultadoRemoto> {
  try {
    const q = client.from(TABELA_PERFIL_SAUDE).select(COLUNAS_PERFIL_SAUDE).eq('user_id', userId);
    return primeiraLinha(await comSinal(q, signal).maybeSingle());
  } catch {
    return { tipo: 'falha' };
  }
}

/** INSERT ... ON CONFLICT (user_id) DO NOTHING. `ok` com perfil = inseriu; `ok` com null = a linha já existia (intocada). */
export async function inserirPerfilSeAusente(
  client: ClientePerfilSaude,
  userId: string,
  perfil: PerfilSaude,
  signal?: AbortSignal,
): Promise<ResultadoRemoto> {
  try {
    const q = client
      .from(TABELA_PERFIL_SAUDE)
      .upsert(perfilParaRow(userId, perfil), { onConflict: 'user_id', ignoreDuplicates: true })
      .select(COLUNAS_PERFIL_SAUDE);
    return primeiraLinha(await comSinal(q, signal));
  } catch {
    return { tipo: 'falha' };
  }
}

/** UPDATE só das colunas dadas, na linha do dono. `ok` com null = nenhuma linha (não existe). */
export async function atualizarColunasPerfil(
  client: ClientePerfilSaude,
  userId: string,
  colunas: Partial<Omit<PerfilSaudeRow, 'user_id' | 'created_at' | 'updated_at'>>,
  signal?: AbortSignal,
): Promise<ResultadoRemoto> {
  try {
    const q = client.from(TABELA_PERFIL_SAUDE).update(colunas).eq('user_id', userId).select(COLUNAS_PERFIL_SAUDE);
    return primeiraLinha(await comSinal(q, signal));
  } catch {
    return { tipo: 'falha' };
  }
}

// ─── Carga ──────────────────────────────────────────────────────────────────

export type FontePerfil = 'conta' | 'ausente' | 'sem_tabela' | 'indisponivel';
export interface EstadoPerfilSaude {
  fonte: FontePerfil;
  /** O que a tela mostra ('indisponivel': o cache do aparelho, só leitura). */
  perfil: PerfilSaude | null;
}

/** Gravar só com estado conhecido. 'indisponivel' = só leitura. */
export const podeGravarPerfil = (fonte: FontePerfil | null | undefined) =>
  fonte === 'conta' || fonte === 'ausente' || fonte === 'sem_tabela';

/**
 * Carga (queryFn). Nunca lança, exceto `OperacaoCancelada` (sinal abortado: nenhum efeito depois disso).
 * - linha na conta: ela vence (e vira o cache), mesmo com um cache local "mais novo";
 * - sem linha + perfil antigo no aparelho: insert-only (ON CONFLICT DO NOTHING) e relê: vale o vencedor;
 * - sem linha e nada no aparelho: 'ausente' (o cadastro abre; criar é permitido);
 * - sem a 016: 'sem_tabela' (o aparelho manda); sem rede/erro: 'indisponivel' (cache, só leitura).
 */
export async function sincronizarPerfilSaude(
  client: ClientePerfilSaude | null,
  userId: string,
  { storage = armazenamento(), signal }: { storage?: Storage | null; signal?: AbortSignal } = {},
): Promise<EstadoPerfilSaude> {
  conferir(signal);
  const local = lerPerfilSaude(userId, storage);
  if (!client) return { fonte: 'indisponivel', perfil: local };
  const lido = await carregarPerfilSaudeRemoto(client, userId, signal);
  conferir(signal);
  if (lido.tipo === 'sem_tabela') return { fonte: 'sem_tabela', perfil: local };
  if (lido.tipo === 'falha') return { fonte: 'indisponivel', perfil: local };
  if (lido.perfil) {
    guardarPerfilSaudeLocal(userId, lido.perfil, storage);
    return { fonte: 'conta', perfil: lido.perfil };
  }
  if (!local) return { fonte: 'ausente', perfil: null };

  // Migração do perfil antigo: nunca um upsert que mescla.
  const inserido = await inserirPerfilSeAusente(client, userId, local, signal);
  conferir(signal);
  if (inserido.tipo !== 'ok') return { fonte: 'indisponivel', perfil: local };
  let vencedor = inserido.perfil;
  if (!vencedor) {
    const relido = await carregarPerfilSaudeRemoto(client, userId, signal);
    conferir(signal);
    if (relido.tipo !== 'ok' || !relido.perfil) return { fonte: 'indisponivel', perfil: local };
    vencedor = relido.perfil;
  }
  guardarPerfilSaudeLocal(userId, vencedor, storage);
  return { fonte: 'conta', perfil: vencedor };
}

// ─── Gravações ──────────────────────────────────────────────────────────────

type ColunasEditaveis = Partial<Omit<PerfilSaudeRow, 'user_id' | 'created_at' | 'updated_at'>>;

/**
 * Grava `colunas` na conta: 'conta' = UPDATE só delas; 'ausente' (ou a linha sumiu) = insert-only de `seCriar` e,
 * se outro aparelho criou antes, UPDATE só das colunas. Falha = `MENSAGEM_ERRO_CADASTRO_SAUDE` (sem dado de saúde).
 */
async function gravarColunas(
  client: ClientePerfilSaude,
  userId: string,
  fonte: 'conta' | 'ausente',
  colunas: ColunasEditaveis,
  seCriar: PerfilSaude,
  signal?: AbortSignal,
): Promise<PerfilSaude> {
  const erro = () => new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
  if (fonte === 'conta') {
    const r = await atualizarColunasPerfil(client, userId, colunas, signal);
    if (r.tipo !== 'ok') throw erro();
    if (r.perfil) return r.perfil;
  }
  const ins = await inserirPerfilSeAusente(client, userId, seCriar, signal);
  if (ins.tipo !== 'ok') throw erro();
  if (ins.perfil) return ins.perfil;
  const r = await atualizarColunasPerfil(client, userId, colunas, signal);
  if (r.tipo !== 'ok' || !r.perfil) throw erro();
  return r.perfil;
}

async function gravarNoEstado(
  client: ClientePerfilSaude | null,
  userId: string,
  estado: EstadoPerfilSaude,
  colunas: ColunasEditaveis,
  aplicar: (base: PerfilSaude) => PerfilSaude,
  baseNova: PerfilSaude,
  { storage = armazenamento(), signal }: { storage?: Storage | null; signal?: AbortSignal },
): Promise<EstadoPerfilSaude> {
  conferir(signal);
  if (estado.fonte === 'sem_tabela') {
    // Sem a 016: só o aparelho (sobe por insert-only na carga depois da 016).
    const local = { ...aplicar(estado.perfil ?? baseNova), atualizadoEm: new Date().toISOString() };
    guardarPerfilSaudeLocal(userId, local, storage);
    return { fonte: 'sem_tabela', perfil: local };
  }
  if (!client || estado.fonte === 'indisponivel') throw new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
  const salvo = await gravarColunas(client, userId, estado.fonte, colunas, aplicar(baseNova), signal);
  conferir(signal);
  guardarPerfilSaudeLocal(userId, salvo, storage);
  return { fonte: 'conta', perfil: salvo };
}

/** "Salvar e começar" do cadastro: estado, respostas, metas e versão da fórmula (prazo/ritmo ficam como estão). */
export function gravarCadastroSaude(
  client: ClientePerfilSaude | null,
  userId: string,
  estado: EstadoPerfilSaude,
  { respostas, metas }: { respostas: RespostasSaude; metas: MetasSaude },
  opcoes: { storage?: Storage | null; signal?: AbortSignal } = {},
): Promise<EstadoPerfilSaude> {
  const aplicar = (p: PerfilSaude): PerfilSaude => ({ ...p, estado: 'respondido', respostas, metas, formulaVersao: FORMULA_SAUDE_VERSAO });
  return gravarNoEstado(
    client, userId, estado,
    { estado: 'respondido', respostas, metas, formula_versao: FORMULA_SAUDE_VERSAO },
    aplicar, perfilVazio('respondido'), opcoes,
  );
}

/** Peso-meta: só `ritmo_pct` e/ou `prazo_meta`. */
export function gravarCamposSaude(
  client: ClientePerfilSaude | null,
  userId: string,
  estado: EstadoPerfilSaude,
  campos: { ritmoPct?: number; prazoMeta?: string | null },
  opcoes: { storage?: Storage | null; signal?: AbortSignal } = {},
): Promise<EstadoPerfilSaude> {
  const colunas: ColunasEditaveis = {};
  if (campos.ritmoPct !== undefined) colunas.ritmo_pct = campos.ritmoPct;
  if (campos.prazoMeta !== undefined) colunas.prazo_meta = campos.prazoMeta;
  return gravarNoEstado(client, userId, estado, colunas, (p) => ({ ...p, ...campos }), perfilVazio('adiado'), opcoes);
}

/**
 * "Agora não" com ausência confirmada: cria a linha 'adiado' por insert-only (nunca sobre uma existente) e devolve o
 * que o banco tiver. null = não deu (fica no aparelho; a próxima carga migra por insert-only).
 */
export async function criarAdiadoSeAusente(
  client: ClientePerfilSaude,
  userId: string,
  { storage = armazenamento(), signal }: { storage?: Storage | null; signal?: AbortSignal } = {},
): Promise<EstadoPerfilSaude | null> {
  const ins = await inserirPerfilSeAusente(client, userId, perfilVazio('adiado'), signal);
  conferir(signal);
  if (ins.tipo !== 'ok') return null;
  let linha = ins.perfil;
  if (!linha) {
    const relido = await carregarPerfilSaudeRemoto(client, userId, signal);
    conferir(signal);
    if (relido.tipo !== 'ok' || !relido.perfil) return null;
    linha = relido.perfil;
  }
  guardarPerfilSaudeLocal(userId, linha, storage);
  return { fonte: 'conta', perfil: linha };
}

// ─── Serialização por conta ─────────────────────────────────────────────────

const filas = new Map<string, Promise<unknown>>();

/**
 * Uma operação de perfil por conta de cada vez (carga, cadastro, edição, "Agora não"), na ordem de chegada: uma carga
 * atrasada nunca grava depois de um salvar explícito. `ms` limita quanto a operação segura a fila; ao estourar, o
 * sinal dela é abortado (nenhum efeito depois) e a fila anda.
 */
export function serializarPerfil<T>(
  userId: string,
  fn: (signal: AbortSignal) => Promise<T>,
  { ms, signal: externo }: { ms?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const anterior = filas.get(userId) ?? Promise.resolve();
  const atual = anterior.then(() => {
    const ctl = new AbortController();
    const abortar = () => ctl.abort();
    if (externo?.aborted) ctl.abort();
    externo?.addEventListener('abort', abortar);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limite = ms
      ? new Promise<never>((_, rejeitar) => {
          timer = setTimeout(() => {
            ctl.abort();
            rejeitar(new OperacaoCancelada());
          }, ms);
        })
      : null;
    const execucao = fn(ctl.signal);
    return (limite ? Promise.race([execucao, limite]) : execucao).finally(() => {
      clearTimeout(timer);
      externo?.removeEventListener('abort', abortar);
    });
  });
  const cauda = atual.catch(() => undefined);
  filas.set(userId, cauda);
  void cauda.then(() => {
    if (filas.get(userId) === cauda) filas.delete(userId);
  });
  return atual;
}

// ─── profiles ───────────────────────────────────────────────────────────────

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
