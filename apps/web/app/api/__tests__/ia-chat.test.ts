import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));
vi.mock('../../../lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }));

import { POST } from '../ia/chat/route';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { MODELO_PADRAO } from '../../../lib/ia/gemini';

/** Chave SINTÉTICA (nunca uma real). */
const CHAVE = 'chave-sintetica-teste-123';
const A = 'user-a';
const CARTEIRA_A = { id: '11111111-1111-4111-8111-111111111111', nome: 'Banco Teste' };

/**
 * Cliente falso do supabase-js: registra tudo o que a rota pede. Escrita (insert/update/delete/upsert/rpc)
 * fica registrada; inserts no chat acumulam na contagem real do mock.
 */
function clienteFalso({ usuario = { id: A } as { id: string } | null, mensagensHoje = 0, erroContagem = false, erroInsert = false } = {}) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const escrita = (tabela: string, metodo: string) => (...args: unknown[]) => {
    chamadas.push({ tabela, metodo, args });
    if (tabela === 'chat_agente' && metodo === 'insert') {
      if (erroInsert) return Promise.resolve({ error: { message: 'insert negado' } });
      mensagensHoje++;
    }
    return Promise.resolve({ data: null, error: null });
  };
  const from = vi.fn((tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte']) {
      q[m] = (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: m, args });
        return q;
      };
    }
    for (const m of ['insert', 'update', 'delete', 'upsert']) q[m] = escrita(tabela, m);
    q.then = (ok: (r: unknown) => unknown) => {
      if (tabela === 'chat_agente') return Promise.resolve(erroContagem ? { count: null, error: { message: 'x' } } : { count: mensagensHoje, error: null }).then(ok);
      if (tabela === 'carteiras') return Promise.resolve({ data: [CARTEIRA_A], error: null }).then(ok);
      return Promise.resolve({ data: [], error: null }).then(ok);
    };
    return q;
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: usuario }, error: null })) },
    from,
    rpc: escrita('rpc', 'rpc'),
  };
  return { client, chamadas };
}

/** Resposta do Gemini com a chamada `propor_gasto`. */
const respostaGemini = (args: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: 'propor_gasto', args } }] } }] }), { status: 200 });

const pedir = (mensagem: unknown) =>
  POST(new Request('http://localhost/api/ia/chat', { method: 'POST', body: JSON.stringify({ mensagem }) }));

const hojeSPISO = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('GEMINI_API_KEY', CHAVE);
  vi.stubEnv('GEMINI_MODEL', '');
  vi.stubEnv('IA_LIMITE_DIARIO', '');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/ia/chat', () => {
  it('401 sem sessão, sem consultar tabela nem o modelo', async () => {
    const { client, chamadas } = clienteFalso({ usuario: null });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const res = await pedir('gastei 45 no mercado');
    expect(res.status).toBe(401);
    expect(chamadas).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"gastei 45 no mercado" → card R$45,00 / Mercado / hoje, gravando só a mensagem no chat', async () => {
    const { client, chamadas } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Mercado', descricao: 'Mercado' }));

    const res = await pedir('gastei 45 no mercado');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      fallback: false,
      gravada: true,
      proposta: { valor: 45, categoria: 'Mercado', descricao: 'Mercado', data: hojeSPISO(), carteira_id: null },
    });
    // Só a mensagem entra no chat; nada em transacoes.
    expect(chamadas.filter((c) => ['insert', 'update', 'delete', 'upsert', 'rpc'].includes(c.metodo))).toEqual([
      { tabela: 'chat_agente', metodo: 'insert', args: [{ user_id: A, role: 'user', conteudo: 'gastei 45 no mercado' }] },
    ]);
    expect(chamadas.some((c) => c.tabela === 'transacoes')).toBe(false);
  });

  it('chama o modelo padrão no servidor com function calling, thinking mínimo, poucos tokens e só o mínimo de dados', async () => {
    const { client } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Mercado' }));
    await pedir('gastei 45 no mercado');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_PADRAO}:generateContent`);
    expect(MODELO_PADRAO).toBe('gemini-3.1-flash-lite');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(CHAVE);
    const corpo = String(init.body);
    expect(corpo).not.toContain(CHAVE); // chave só no header
    const req = JSON.parse(corpo);
    expect(req.tools[0].functionDeclarations[0].name).toBe('propor_gasto');
    expect(req.generationConfig.maxOutputTokens).toBeLessThanOrEqual(256);
    expect(req.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    // Mínimo: mensagem, categorias, nomes das carteiras, data. Nem id de carteira nem id do usuário.
    expect(req.contents).toEqual([{ role: 'user', parts: [{ text: 'gastei 45 no mercado' }] }]);
    const sistema = req.systemInstruction.parts[0].text as string;
    expect(sistema).toContain('Mercado');
    expect(sistema).toContain(CARTEIRA_A.nome);
    expect(corpo).not.toContain(CARTEIRA_A.id);
    expect(corpo).not.toContain(A);
  });

  it('GEMINI_MODEL troca o modelo; 2.5 usa thinkingBudget 0', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash-lite');
    const { client } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Mercado' }));
    await pedir('gastei 45 no mercado');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-2.5-flash-lite:generateContent');
    expect(JSON.parse(String(init.body)).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('carteira citada pelo modelo vira o id da carteira do usuário', async () => {
    const { client } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    fetchMock.mockResolvedValue(respostaGemini({ valor: 20, categoria: 'Comida', carteira: 'banco teste' }));
    const json = await (await pedir('lanche 20 no banco teste')).json();
    expect(json.proposta.carteira_id).toBe(CARTEIRA_A.id);
  });

  it('sem GEMINI_API_KEY → fallback, sem chamar o modelo', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const { client } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    expect(await (await pedir('gastei 45 no mercado')).json()).toEqual({ fallback: true, gravada: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 500', () => fetchMock.mockResolvedValue(new Response('erro', { status: 500 }))],
    ['cota estourada (429)', () => fetchMock.mockResolvedValue(new Response('{}', { status: 429 }))],
    ['rede caída', () => fetchMock.mockRejectedValue(new TypeError('fetch failed'))],
    ['timeout', () => fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))],
    ['JSON quebrado', () => fetchMock.mockResolvedValue(new Response('não é json', { status: 200 }))],
    ['modelo não chamou a função', () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] })))],
    ['valor negativo', () => fetchMock.mockResolvedValue(respostaGemini({ valor: -45, categoria: 'Mercado' }))],
    ['categoria inventada', () => fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Cassino' }))],
    ['data inválida', () => fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Mercado', data: 'ontem' }))],
  ])('LLM com problema (%s) → fallback 200, preservando só a mensagem no chat', async (_nome, preparar) => {
    preparar();
    const { client, chamadas } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    const res = await pedir('gastei 45 no mercado');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fallback: true, gravada: true });
    expect(chamadas.filter((c) => ['insert', 'update', 'delete', 'upsert', 'rpc'].includes(c.metodo))).toEqual([
      { tabela: 'chat_agente', metodo: 'insert', args: [{ user_id: A, role: 'user', conteudo: 'gastei 45 no mercado' }] },
    ]);
  });

  it('limite diário: conta as mensagens do usuário hoje (BRT) em chat_agente; acima de 50 → fallback sem chamar o modelo', async () => {
    const { client, chamadas } = clienteFalso({ mensagensHoje: 51 });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    expect(await (await pedir('gastei 45 no mercado')).json()).toEqual({ fallback: true, gravada: true });
    expect(fetchMock).not.toHaveBeenCalled();
    const contagem = chamadas.filter((c) => c.tabela === 'chat_agente');
    expect(contagem).toContainEqual({ tabela: 'chat_agente', metodo: 'select', args: ['id', { count: 'exact', head: true }] });
    expect(contagem).toContainEqual({ tabela: 'chat_agente', metodo: 'eq', args: ['user_id', A] });
    expect(contagem).toContainEqual({ tabela: 'chat_agente', metodo: 'eq', args: ['role', 'user'] });
    const gte = contagem.find((c) => c.metodo === 'gte')!;
    expect(gte.args[0]).toBe('created_at');
    // 00:00 de hoje em SP = 03:00Z
    expect(String(gte.args[1])).toMatch(/T03:00:00\.000Z$/);
  });

  it('exatamente 50 ainda passa; IA_LIMITE_DIARIO muda o limite', async () => {
    fetchMock.mockResolvedValue(respostaGemini({ valor: 45, categoria: 'Mercado' }));
    vi.mocked(createServerSupabaseClient).mockReturnValue(clienteFalso({ mensagensHoje: 49 }).client as never);
    expect((await (await pedir('gastei 45 no mercado')).json()).fallback).toBe(false);

    vi.stubEnv('IA_LIMITE_DIARIO', '3');
    vi.mocked(createServerSupabaseClient).mockReturnValue(clienteFalso({ mensagensHoje: 4 }).client as never);
    expect(await (await pedir('gastei 45 no mercado')).json()).toEqual({ fallback: true, gravada: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('60 POSTs diretos consomem cota: só 50 chegam ao Gemini', async () => {
    const { client, chamadas } = clienteFalso();
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    fetchMock.mockImplementation(() => Promise.resolve(respostaGemini({ valor: 45, categoria: 'Mercado' })));
    const resultados = [];
    for (let i = 0; i < 60; i++) resultados.push(await (await pedir('gastei 45 no mercado')).json());
    expect(fetchMock).toHaveBeenCalledTimes(50);
    expect(resultados.filter((r) => !r.fallback)).toHaveLength(50);
    expect(chamadas.filter((c) => c.metodo === 'insert')).toHaveLength(60);
    expect(chamadas[0]).toMatchObject({ tabela: 'chat_agente', metodo: 'insert' });
  });

  it('erro no insert → fallback sem contagem nem Gemini', async () => {
    const { client, chamadas } = clienteFalso({ erroInsert: true });
    vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
    expect(await (await pedir('gastei 45 no mercado')).json()).toEqual({ fallback: true, gravada: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(chamadas.map((c) => c.metodo)).toEqual(['insert']);
  });

  it('erro na contagem → fallback (não gasta cota sem saber)', async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(clienteFalso({ erroContagem: true }).client as never);
    expect(await (await pedir('gastei 45 no mercado')).json()).toEqual({ fallback: true, gravada: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corpo inválido → 400', async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(clienteFalso().client as never);
    expect((await pedir('')).status).toBe(400);
    expect((await pedir('x'.repeat(501))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('rotas e módulos de IA: sem service-role, chave só no servidor', () => {
  const raiz = path.resolve(__dirname, '../../..');
  const arquivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      if (f === '__tests__') return [];
      return statSync(p).isDirectory() ? arquivos(p) : [p];
    });
  const fontes = [...arquivos(path.join(raiz, 'app/api/ia')), ...arquivos(path.join(raiz, 'lib/ia'))];

  it('nenhum arquivo usa service_role nem createClient do supabase-js', () => {
    expect(fontes.length).toBeGreaterThanOrEqual(4);
    for (const f of fontes) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/SERVICE_ROLE_KEY|\bcreateClient\s*\(|createAdminClient|supabaseAdmin/i);
    }
  });

  it('GEMINI_API_KEY só no módulo server-only da rota, nunca com NEXT_PUBLIC_', () => {
    for (const f of fontes) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toContain('NEXT_PUBLIC_GEMINI');
      if (s.includes('generativelanguage.googleapis.com')) expect(s.startsWith("import 'server-only';"), f).toBe(true);
    }
    const comChave = fontes.filter((f) => readFileSync(f, 'utf8').includes('GEMINI_API_KEY'));
    expect(comChave.map((f) => path.relative(raiz, f))).toEqual([path.join('lib', 'ia', 'gemini.ts')]);
    const gemini = readFileSync(path.join(raiz, 'lib/ia/gemini.ts'), 'utf8');
    expect(gemini.startsWith("import 'server-only';")).toBe(true);
  });
});
