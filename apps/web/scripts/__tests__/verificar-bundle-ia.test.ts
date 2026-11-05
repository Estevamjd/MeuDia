import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { procurarVazamentos, termosProibidos } from '../verificar-bundle-ia.mjs';

/** Chave SINTÉTICA, só para o teste. */
const CHAVE = 'AIza-sintetica-0000-teste-bundle';
let dir: string;
const criar = (arquivos: Record<string, string>) => {
  dir = mkdtempSync(path.join(tmpdir(), 'bundle-ia-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    mkdirSync(path.dirname(path.join(dir, nome)), { recursive: true });
    writeFileSync(path.join(dir, nome), conteudo);
  }
  return dir;
};
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('verificar-bundle-ia (chave do Gemini fora de .next/static)', () => {
  const termos = termosProibidos({ GEMINI_API_KEY: CHAVE });

  it('bundle limpo passa', () => {
    expect(procurarVazamentos(criar({ 'chunks/app.js': 'fetch("/api/ia/chat")' }), termos)).toEqual([]);
  });

  it.each([
    ['nome da env', 'process.env.GEMINI_API_KEY'],
    ['host da API', 'https://generativelanguage.googleapis.com/v1beta'],
    ['valor da chave', `headers:{"x-goog-api-key":"${CHAVE}"}`],
  ])('falha com %s num chunk', (_nome, conteudo) => {
    const achados = procurarVazamentos(criar({ 'chunks/pages/a.js': `var a=1;${conteudo};` }), termos);
    expect(achados).toHaveLength(1);
    expect(achados[0]!.arquivo).toMatch(/a\.js$/);
  });

  it('o rótulo do achado nunca carrega o valor da chave', () => {
    const achados = procurarVazamentos(criar({ 'x.js': CHAVE }), termos);
    expect(achados.map((a) => a.rotulo)).toEqual(['valor de GEMINI_API_KEY']);
    expect(JSON.stringify(achados)).not.toContain(CHAVE);
  });

  it('sem chave no ambiente procura só nome e host', () => {
    expect(termosProibidos({}).map((t) => t.rotulo)).toEqual(['GEMINI_API_KEY', 'generativelanguage.googleapis.com']);
  });
});
