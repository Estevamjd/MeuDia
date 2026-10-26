#!/usr/bin/env node
// Falha se a chave do Gemini vazar para o bundle do cliente (.next/static).
// Procura o nome da env, o host da API do Gemini e, se `GEMINI_API_KEY` estiver definida no processo
// (build de teste com chave SINTÉTICA), o valor dela. Nunca imprime o valor: só o rótulo do termo.
// Uso (depois do `next build`): node scripts/verificar-bundle-ia.mjs [diretório .next/static]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {{ rotulo: string; valor: string }[]} */
export function termosProibidos(env = process.env) {
  const termos = [
    { rotulo: 'GEMINI_API_KEY', valor: 'GEMINI_API_KEY' },
    { rotulo: 'generativelanguage.googleapis.com', valor: 'generativelanguage.googleapis.com' },
  ];
  const chave = env.GEMINI_API_KEY?.trim();
  if (chave) termos.push({ rotulo: 'valor de GEMINI_API_KEY', valor: chave });
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
  const comValor = termos.some((t) => t.rotulo === 'valor de GEMINI_API_KEY');
  console.log(`bundle-ia ok: ${termos.length} termos (${comValor ? 'com' : 'sem'} valor de chave) ausentes de ${path.relative(process.cwd(), dir) || dir}`);
}
