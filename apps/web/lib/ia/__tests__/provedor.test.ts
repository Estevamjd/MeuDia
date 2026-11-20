import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { chamarClaude, custoUSD } from '../provedor';
afterEach(() => vi.unstubAllEnvs());
it('sem chave não chama a rede', async () => {
 vi.stubEnv('ANTHROPIC_API_KEY', '');
 const f = vi.fn();
 expect(await chamarClaude({ uso: 'chat_gasto', system: 's', mensagem: 'm', maxTokens: 256 }, f)).toBeNull();
 expect(f).not.toHaveBeenCalled();
});
it.each([['novo','antigo','novo'],['','antigo','antigo'],['','','claude-haiku-4-5']])('prioridade dos modelos %s %s', async (novo, antigo, esperado) => {
 vi.stubEnv('ANTHROPIC_API_KEY', 'sintetica'); vi.stubEnv('IA_MODELO', novo); vi.stubEnv('WHATSAPP_IA_MODELO', antigo);
 const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'propor_gasto', input: { valor: 5 } }] })));
 const ferramenta = { name: 'propor_gasto', description: 'd', input_schema: { type: 'object' } };
 expect(await chamarClaude({ uso: 'chat_gasto', system: 's', mensagem: 'm', maxTokens: 256, ferramenta }, f)).toEqual({ tipo: 'ferramenta', input: { valor: 5 } });
 const body = JSON.parse(f.mock.calls[0]![1].body);
 expect(body.model).toBe(esperado); expect(body.tool_choice).toEqual({ type: 'tool', name: 'propor_gasto' }); expect(body.max_tokens).toBe(256);
});
it('rede e HTTP falham sem logar erro, chave ou mensagem', async () => {
 vi.stubEnv('ANTHROPIC_API_KEY', 'sintetica'); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 try {
 const p = { uso: 'chat_gasto' as const, system: 's', mensagem: 'mensagem-secreta', maxTokens: 256 };
 expect(await chamarClaude(p, vi.fn().mockRejectedValue(new Error('sintetica mensagem-secreta')))).toBeNull();
 expect(await chamarClaude(p, vi.fn().mockResolvedValue(new Response('mensagem-secreta', { status: 429 })))).toBeNull();
 expect(JSON.stringify(warn.mock.calls)).not.toMatch(/sintetica|mensagem-secreta/);
 } finally { warn.mockRestore(); }
});
it('custo mantém preço Haiku', () => expect(custoUSD(1000000,1000000)).toBe(6));

it('trim, temperatura e custo somente para Haiku padrão', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', '  sintetica  ');
  vi.stubEnv('IA_MODELO', 'outro-modelo');
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 10, output_tokens: 5 } })));
  try {
    await chamarClaude({ uso: 'chat_gasto', system: 's', mensagem: 'm', maxTokens: 256, temperatura: 0 }, f);
    expect(f.mock.calls[0]![1].headers['x-api-key']).toBe('sintetica');
    expect(JSON.parse(f.mock.calls[0]![1].body).temperature).toBe(0);
    expect(JSON.stringify(info.mock.calls)).not.toContain('custo_usd');
    vi.stubEnv('ANTHROPIC_API_KEY', '  ');
    f.mockClear();
    expect(await chamarClaude({ uso: 'chat_gasto', system: 's', mensagem: 'm', maxTokens: 256 }, f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  } finally { info.mockRestore(); }
});
it('timeout tem motivo separado da rede', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sintetica');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await chamarClaude({ uso: 'chat_gasto', system: 's', mensagem: 'm', maxTokens: 256 }, vi.fn().mockRejectedValue(new DOMException('privado', 'TimeoutError')));
    expect(warn).toHaveBeenCalledWith('[ia] uso=chat_gasto fallback motivo=timeout');
  } finally { warn.mockRestore(); }
});
