import type { ClientePerfilSaude, PerfilSaudeRow } from '../perfil-saude';

/**
 * PostgREST falso para `perfil_saude` (contrato da 016), em memória: PK user_id, updated_at pelo "trigger",
 * upsert com ignoreDuplicates = INSERT ... ON CONFLICT DO NOTHING (devolve só as inseridas), update só das colunas
 * dadas e lista vazia quando nenhuma linha casa. Portões controlam a ordem: a leitura tira a foto e depois espera o
 * portão; a gravação espera o portão e só então grava. Um sinal abortado encerra a espera (como o fetch abortado).
 */
type Op = 'select' | 'upsert' | 'update';
type Erro = { code?: string; message?: string };
export type Falha = { error: Erro; status: number } | 'rede';

export interface Chamada {
  op: Op;
  corpo?: Record<string, unknown>;
  opcoes?: Record<string, unknown>;
  filtro?: unknown[];
}

export class BancoFalso {
  linhas = new Map<string, PerfilSaudeRow>();
  chamadas: Chamada[] = [];
  falhas: Partial<Record<Op, Falha>> = {};
  portoes: Partial<Record<Op, Promise<void>>> = {};
  private tique = 0;

  agora() {
    this.tique += 1;
    return `2026-11-20T10:00:${String(this.tique).padStart(2, '0')}.000Z`;
  }

  semear(userId: string, linha: Omit<PerfilSaudeRow, 'user_id' | 'updated_at'> & { updated_at?: string }) {
    this.linhas.set(userId, { ...linha, user_id: userId, updated_at: linha.updated_at ?? this.agora() });
  }

  /** Portão manual: `abrir()` libera a operação. */
  portao(op: Op) {
    let abrir!: () => void;
    this.portoes[op] = new Promise<void>((r) => (abrir = r));
    return () => {
      delete this.portoes[op];
      abrir();
    };
  }

  ops() {
    return this.chamadas.map((c) => c.op);
  }

  async esperar(op: Op, signal: AbortSignal | undefined) {
    const portao = this.portoes[op];
    if (!portao) return false;
    if (!signal) {
      await portao;
      return false;
    }
    if (signal.aborted) return true;
    return Promise.race([
      portao.then(() => false),
      new Promise<boolean>((r) => signal.addEventListener('abort', () => r(true), { once: true })),
    ]);
  }

  falhou(op: Op) {
    const f = this.falhas[op];
    if (!f) return null;
    if (f === 'rede') throw new TypeError('Failed to fetch');
    return { data: null, error: f.error, status: f.status };
  }

  get client(): ClientePerfilSaude {
    return clienteDe(this);
  }
}

function clienteDe(banco: BancoFalso): ClientePerfilSaude {
  const abortado = { data: null, error: { code: '', message: 'AbortError' }, status: 0 };
  return {
    from(tabela: string) {
      if (tabela !== 'perfil_saude') throw new Error(`tabela inesperada ${tabela}`);
      return {
        select: () => ({
          eq: (...filtro: unknown[]) => {
            let signal: AbortSignal | undefined;
            const q = {
              abortSignal: (s: AbortSignal) => ((signal = s), q),
              maybeSingle: async () => {
                banco.chamadas.push({ op: 'select', filtro });
                const f = banco.falhou('select');
                const foto = banco.linhas.get(String(filtro[1]));
                const copia = foto ? structuredClone(foto) : null;
                if (await banco.esperar('select', signal)) return abortado;
                return f ?? { data: copia, error: null, status: 200 };
              },
            };
            return q;
          },
        }),
        upsert: (corpo: PerfilSaudeRow, opcoes: Record<string, unknown>) => ({
          select: () => {
            let signal: AbortSignal | undefined;
            const executar = async () => {
              banco.chamadas.push({ op: 'upsert', corpo: { ...corpo }, opcoes });
              if (await banco.esperar('upsert', signal)) return abortado;
              const f = banco.falhou('upsert');
              if (f) return f;
              const existente = banco.linhas.get(corpo.user_id);
              if (existente) {
                if (opcoes?.ignoreDuplicates) return { data: [], error: null, status: 201 };
                throw new Error('teste: upsert que mescla não é permitido no perfil de saúde');
              }
              const linha = { ...corpo, updated_at: banco.agora() };
              banco.linhas.set(corpo.user_id, linha);
              return { data: [structuredClone(linha)], error: null, status: 201 };
            };
            const q = {
              abortSignal: (s: AbortSignal) => ((signal = s), q),
              then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => executar().then(ok, erro),
            };
            return q;
          },
        }),
        update: (colunas: Record<string, unknown>) => ({
          eq: (...filtro: unknown[]) => ({
            select: () => {
              let signal: AbortSignal | undefined;
              const executar = async () => {
                banco.chamadas.push({ op: 'update', corpo: { ...colunas }, filtro });
                if (await banco.esperar('update', signal)) return abortado;
                const f = banco.falhou('update');
                if (f) return f;
                const atual = banco.linhas.get(String(filtro[1]));
                if (!atual) return { data: [], error: null, status: 200 };
                const linha = { ...atual, ...colunas, updated_at: banco.agora() } as PerfilSaudeRow;
                banco.linhas.set(atual.user_id, linha);
                return { data: [structuredClone(linha)], error: null, status: 200 };
              };
              const q = {
                abortSignal: (s: AbortSignal) => ((signal = s), q),
                then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => executar().then(ok, erro),
              };
              return q;
            },
          }),
        }),
      };
    },
  };
}

export class Memoria implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
