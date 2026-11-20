'use client';

import { useCallback, useEffect, useState } from 'react';
import { onlineManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { MetasSaude, RespostasSaude } from '@meudia/shared';
import { getSupabase } from '@meudia/api';
import { useAuth } from './useAuth';
import {
  EVENTO_PERFIL_SAUDE,
  MENSAGEM_ERRO_CADASTRO_SAUDE,
  criarAdiadoSeAusente,
  gravarCadastroSaude,
  gravarCamposSaude,
  guardarPerfilSaudeLocal,
  lerPerfilSaude,
  perfilVazio,
  podeGravarPerfil,
  serializarPerfil,
  sincronizarPerfilSaude,
  type ClientePerfilSaude,
  type EstadoPerfilSaude,
  type PerfilSaude,
} from '../lib/perfil-saude';

export const chavePerfilSaude = (userId: string | undefined) => ['perfil-saude', userId] as const;

/** Quanto uma carga ou gravação pode segurar a fila do perfil (depois disso: abortada, sem efeito). */
export const TEMPO_LIMITE_PERFIL_MS = 15_000;
/** "Agora não" cria a linha em segundo plano por no máximo isto. */
export const TEMPO_LIMITE_ADIAR_MS = 8_000;
/** Estado conhecido da conta fica fresco por isto; 'indisponivel' fica velho na hora (volta da rede relê). */
export const FRESCOR_PERFIL_MS = 5 * 60_000;

function cliente(): ClientePerfilSaude | null {
  try {
    return getSupabase();
  } catch {
    return null;
  }
}

/** Uma criação de 'adiado' por conta de cada vez (vários toques em "Agora não" = uma requisição). */
const adiamentos = new Map<string, Promise<unknown>>();

async function executarGravacao(
  queryClient: QueryClient,
  userId: string,
  gravar: (estado: EstadoPerfilSaude, signal: AbortSignal) => Promise<EstadoPerfilSaude>,
): Promise<PerfilSaude | null> {
  const chave = chavePerfilSaude(userId);
  // Uma carga em andamento é abortada (não grava nada depois disso) e a gravação entra na fila depois dela.
  await queryClient.cancelQueries({ queryKey: chave });
  const novo = await serializarPerfil(
    userId,
    async (signal) => {
      let estado = queryClient.getQueryData<EstadoPerfilSaude>(chave);
      if (!estado || !podeGravarPerfil(estado.fonte)) {
        // Sem estado conhecido: tenta conhecer agora; sem sucesso, não grava (só leitura).
        estado = await sincronizarPerfilSaude(cliente(), userId, { signal });
        queryClient.setQueryData(chave, estado);
        if (!podeGravarPerfil(estado.fonte)) throw new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
      }
      return gravar(estado, signal);
    },
    { ms: TEMPO_LIMITE_PERFIL_MS },
  ).catch((e: unknown) => {
    throw e instanceof Error && e.message === MENSAGEM_ERRO_CADASTRO_SAUDE ? e : new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
  });
  queryClient.setQueryData(chave, novo);
  return novo.perfil;
}

/**
 * Perfil de saúde da conta (`perfil_saude`) com o cache do aparelho na frente:
 * - `perfil` = o da carga quando termina; antes disso (ou se a conta não tem e o aparelho tem "Agora não"), o cache;
 * - `carregado` = já dá para decidir se o cadastro abre (carga terminou ou há cache);
 * - `podeEditar` = a carga terminou com estado conhecido ('conta', 'ausente' ou 'sem_tabela'). Sem rede/erro: só
 *   leitura (controles desligados), nada é gravado; offline já sabido termina na hora como 'indisponivel';
 * - 'indisponivel' relê sozinho quando a rede volta (uma vez) e `recarregar` relê sob pedido ("Tentar de novo");
 * - `salvarCadastro` (linha inteira do cadastro) e `atualizar` (só ritmo/prazo) lançam `MENSAGEM_ERRO_CADASTRO_SAUDE`;
 * - `adiar` ("Agora não") fecha na hora: grava 'adiado' no aparelho e, com ausência confirmada, cria a linha em
 *   segundo plano (insert-only, uma por vez, com tempo limite).
 * Toda carga/gravação passa por `serializarPerfil` (uma por conta) e respeita o sinal de cancelamento.
 */
export function usePerfilSaude() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const chaveQuery = chavePerfilSaude(userId);
  // Cache lido num efeito (o mesmo HTML no servidor e na 1ª pintura do cliente).
  const [local, setLocal] = useState<{ userId: string; perfil: PerfilSaude | null } | null>(null);

  const query = useQuery({
    queryKey: chaveQuery,
    queryFn: ({ signal }) => {
      const indisponivel = (): EstadoPerfilSaude => ({ fonte: 'indisponivel', perfil: lerPerfilSaude(userId!) });
      // Sem rede já sabida: termina na hora como só leitura (nada de esqueleto até a rede voltar).
      if (!onlineManager.isOnline()) return Promise.resolve(indisponivel());
      return serializarPerfil(userId!, (s) => sincronizarPerfilSaude(cliente(), userId!, { signal: s }), { signal, ms: TEMPO_LIMITE_PERFIL_MS }).catch(
        (e: unknown) => {
          // Cancelada pelo React Query: propaga (o estado volta ao anterior). Tempo limite/erro: só leitura do cache.
          if (signal.aborted) throw e;
          return indisponivel();
        },
      );
    },
    enabled: !!userId,
    // 'always': a carga roda mesmo com o aparelho offline (o padrão 'online' pausaria antes do queryFn, e o
    // esqueleto ficaria até a rede voltar); o próprio queryFn resolve como 'indisponivel'.
    networkMode: 'always',
    // Só leitura por falha de rede fica velho na hora: a volta da rede relê uma vez (refetchOnReconnect); nenhum
    // intervalo nem retry automático (sem laço). Estados conhecidos seguem frescos por 5 min.
    staleTime: (q) => (q.state.data?.fonte === 'indisponivel' ? 0 : FRESCOR_PERFIL_MS),
    refetchOnReconnect: true,
    retry: false,
  });

  useEffect(() => {
    if (!userId) return;
    const ler = () => setLocal({ userId, perfil: lerPerfilSaude(userId) });
    ler();
    // Outra aba gravou: relê o cache e a conta (a conta continua mandando).
    const deOutraAba = (e: StorageEvent) => {
      if (e.key && !e.key.endsWith(userId)) return;
      ler();
      void queryClient.invalidateQueries({ queryKey: chavePerfilSaude(userId) });
    };
    window.addEventListener(EVENTO_PERFIL_SAUDE, ler);
    window.addEventListener('storage', deOutraAba);
    return () => {
      window.removeEventListener(EVENTO_PERFIL_SAUDE, ler);
      window.removeEventListener('storage', deOutraAba);
    };
  }, [userId, queryClient]);

  const localDaConta = local && local.userId === userId ? local.perfil : null;
  const estado = query.isSuccess ? query.data : undefined;
  const perfil = estado?.perfil ?? localDaConta;
  const carregado = !!userId && (query.isSuccess || localDaConta !== null);
  const podeEditar = !!userId && query.isSuccess && podeGravarPerfil(estado?.fonte);

  const salvarCadastro = useCallback(
    async (respostas: RespostasSaude, metas: MetasSaude) => {
      if (!userId) throw new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
      return executarGravacao(queryClient, userId, (e, signal) => gravarCadastroSaude(cliente(), userId, e, { respostas, metas }, { signal }));
    },
    [userId, queryClient],
  );

  const atualizar = useCallback(
    async (campos: { ritmoPct?: number; prazoMeta?: string | null }) => {
      if (!userId) throw new Error(MENSAGEM_ERRO_CADASTRO_SAUDE);
      return executarGravacao(queryClient, userId, (e, signal) => gravarCamposSaude(cliente(), userId, e, campos, { signal }));
    },
    [userId, queryClient],
  );

  const adiar = useCallback(() => {
    if (!userId) return;
    const atual = queryClient.getQueryData<EstadoPerfilSaude>(chavePerfilSaude(userId));
    // Já existe perfil (na conta ou no aparelho): "Agora não" só fecha; nunca grava 'adiado' por cima.
    if (atual?.perfil || lerPerfilSaude(userId)) return;
    const adiado = perfilVazio('adiado');
    guardarPerfilSaudeLocal(userId, adiado);
    setLocal({ userId, perfil: adiado });
    if (atual?.fonte === 'sem_tabela') {
      queryClient.setQueryData<EstadoPerfilSaude>(chavePerfilSaude(userId), { fonte: 'sem_tabela', perfil: adiado });
      return;
    }
    // Criar na conta só com ausência confirmada; senão fica no aparelho (a próxima carga migra por insert-only).
    if (atual?.fonte !== 'ausente' || adiamentos.has(userId)) return;
    const client = cliente();
    if (!client) return;
    const tarefa = serializarPerfil(userId, (signal) => criarAdiadoSeAusente(client, userId, { signal }), { ms: TEMPO_LIMITE_ADIAR_MS })
      .then((novo) => {
        if (novo) queryClient.setQueryData(chavePerfilSaude(userId), novo);
      })
      .catch(() => undefined)
      .finally(() => adiamentos.delete(userId));
    adiamentos.set(userId, tarefa);
  }, [userId, queryClient]);

  const { refetch } = query;
  /** "Tentar de novo" (erro do servidor com o navegador online): uma releitura, só quando pedida. */
  const recarregar = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { perfil, carregado, podeEditar, fonte: estado?.fonte ?? null, salvarCadastro, atualizar, adiar, recarregar };
}
