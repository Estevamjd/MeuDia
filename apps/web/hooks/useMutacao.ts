'use client';

import {
  onlineManager,
  useMutation,
  type DefaultError,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

export const MENSAGEM_SEM_INTERNET = 'Sem internet. Confira a conexão e tente de novo.';

export class ErroSemInternet extends Error {
  constructor() {
    super(MENSAGEM_SEM_INTERNET);
    this.name = 'ErroSemInternet';
  }
}

/** Offline para o React Query (eventos online/offline) ou para o navegador. Heurística: só serve para nomear o erro. */
export function estaOffline(): boolean {
  if (!onlineManager.isOnline()) return true;
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// fetch do Chrome/Firefox/Safari, timeout/abort do fetch e o mesmo erro embrulhado pelo supabase-js
// (`{ message: 'TypeError: Failed to fetch' }` → `erroDb` → AppError com essa mensagem).
const MENSAGEM_DE_REDE = /failed to fetch|load failed|networkerror|network request failed|fetcherror|aborterror|timeouterror|the operation was aborted/i;

/** Falha de transporte (a requisição não teve resposta), olhando o erro e a cadeia de `cause`. */
export function ehErroDeRede(erro: unknown): boolean {
  for (let atual = erro, i = 0; atual && i < 5; i++) {
    if (typeof atual !== 'object') return typeof atual === 'string' && MENSAGEM_DE_REDE.test(atual);
    const { name, message, cause } = atual as { name?: unknown; message?: unknown; cause?: unknown };
    if (name === 'AbortError' || name === 'TimeoutError') return true;
    if (typeof message === 'string' && MENSAGEM_DE_REDE.test(message)) return true;
    atual = cause;
  }
  return false;
}

/**
 * `useMutation` sem fila offline escondida. O padrão do React Query (`networkMode: 'online'`) PAUSA a mutação
 * sem rede e a executa quando a rede volta, sem a tela saber. Aqui toda gravação usa `networkMode: 'always'`:
 * o serviço é SEMPRE tentado (os sinais de conexão do navegador têm falso negativo e não vetam nada). Se ele falhar
 * por rede (fetch/timeout) e o aparelho se diz offline, o erro vira `ErroSemInternet` (pt-BR, o `onError` da tela
 * mostra o toast); qualquer outro erro segue igual. Nada é repetido sozinho. Todo hook de gravação passa por aqui
 * (varredura em `hooks/__tests__/sem-fila-offline.test.tsx`).
 */
export function useMutacao<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  queryClient?: QueryClient,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { mutationFn } = options;
  return useMutation(
    {
      ...options,
      networkMode: 'always',
      mutationFn: async (variables, context) => {
        if (!mutationFn) throw new Error('mutationFn ausente');
        try {
          return await mutationFn(variables, context);
        } catch (erro) {
          if (ehErroDeRede(erro) && estaOffline()) throw new ErroSemInternet();
          throw erro;
        }
      },
    },
    queryClient,
  );
}
