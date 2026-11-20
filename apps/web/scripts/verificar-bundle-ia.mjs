#!/usr/bin/env node
// Falha se nomes, hosts ou valores de chaves dos provedores vazarem para .next/static.
// Valores nunca são impressos: só o rótulo do termo.
// Uso (depois do `next build`): node scripts/verificar-bundle-ia.mjs [diretório .next/static]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {{ rotulo: string; valor: string }[]} */
export function termosProibidos(env = process.env) {
  const termos = [
    { rotulo: 'ANTHROPIC_API_KEY', valor: 'ANTHROPIC_API_KEY' },
    { rotulo: 'api.anthropic.com', valor: 'api.anthropic.com' },
    { rotulo: 'GEMINI_API_KEY', valor: 'GEMINI_API_KEY' },
    { rotulo: 'generativelanguage', valor: 'generativelanguage' },
  ];
  for (const nome of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY']) {
    const chave = env[nome];
    if (chave?.trim()) termos.push({ rotulo: `valor de ${nome}`, valor: chave });
  }
  return termos;
}

function arquivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });
}

/** Lista { arquivo, rotulo } de cada termo encontrado em `dir`. */
export function procurarVazamentos(dir, termos) {
  const achados = [];
  for (const arquivo of arquivos(dir)) {
    const conteudo = readFileSync(arquivo, 'latin1');
    for (const t of termos) if (conteudo.includes(t.valor)) achados.push({ arquivo, rotulo: t.rotulo });
  }
  return achados;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../.next/static'));
  let existe = false;
  try {
    existe = statSync(dir).isDirectory();
  } catch {
    existe = false;
  }
  if (!existe) {
    console.error(`bundle-ia: ${dir} não existe (rode o next build antes)`);
    process.exit(1);
  }
  const termos = termosProibidos();
  const achados = procurarVazamentos(dir, termos);
  if (achados.length) {
    for (const a of achados) console.error(`bundle-ia FALHOU: "${a.rotulo}" em ${path.relative(process.cwd(), a.arquivo)}`);
    process.exit(1);
  }
  const comValor = termos.some((t) => t.rotulo.startsWith('valor de '));
  console.log(`bundle-ia ok: ${termos.length} termos (${comValor ? 'com' : 'sem'} valor de chave) ausentes de ${path.relative(process.cwd(), dir) || dir}`);
}
