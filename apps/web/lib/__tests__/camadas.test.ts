import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMADAS } from '../camadas';
import config from '../../tailwind.config';

const RAIZ = path.resolve(__dirname, '../..');

function arquivosTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : arquivosTsx(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

describe('escala de camadas (z-index)', () => {
  it('ordem: header < banner < nav < modal < agente < toast < sobreposicao', () => {
    const ordem = ['header', 'banner', 'nav', 'modal', 'agente', 'toast', 'sobreposicao'] as const;
    const valores = ordem.map((c) => CAMADAS[c]);
    expect([...valores].sort((a, b) => a - b)).toEqual(valores);
    expect(new Set(valores).size).toBe(valores.length);
  });

  it('o Tailwind expõe a escala como z-<camada>', () => {
    const z = config.theme?.extend?.zIndex as Record<string, string>;
    for (const [nome, valor] of Object.entries(CAMADAS)) expect(z[nome]).toBe(String(valor));
  });

  it('nenhum elemento fixed/sticky usa z-index numérico solto (use z-<camada>)', () => {
    const violacoes: string[] = [];
    for (const arq of [...arquivosTsx(path.join(RAIZ, 'app')), ...arquivosTsx(path.join(RAIZ, 'components'))]) {
      fs.readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
        if (/\b(fixed|sticky)\b/.test(linha) && /(^|[\s'"`])z-(\d+|\[[^\]]+\])/.test(linha)) {
          violacoes.push(`${path.relative(RAIZ, arq)}:${i + 1}`);
        }
      });
    }
    expect(violacoes).toEqual([]);
  });
});
