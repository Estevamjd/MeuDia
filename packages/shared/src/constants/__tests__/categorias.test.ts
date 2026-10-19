import { describe, expect, it } from 'vitest';
import { CATEGORIAS, CATEGORIAS_GASTO, categoriaInfo } from '../categorias';

describe('mapa de ícones (decisão 2 do BRIEF-ICONES-ABAS)', () => {
  it('comida = utensils (prato), unha = paintbrush (esmalte)', () => {
    expect(categoriaInfo('Comida').icone).toBe('utensils');
    expect(categoriaInfo('Unha').icone).toBe('paintbrush');
  });

  it('Sobrancelha é categoria própria com eye, fora de Estética', () => {
    const sobrancelha = categoriaInfo('Sobrancelha');
    expect(sobrancelha.nome).toBe('Sobrancelha');
    expect(sobrancelha.icone).toBe('eye');
    expect(sobrancelha.grupo).toBe('gasto');
    expect(categoriaInfo('sobrancelha').nome).toBe('Sobrancelha');
    const estetica = CATEGORIAS.find((c) => c.nome === 'Estética')!;
    expect(estetica.aliases ?? []).not.toContain('Sobrancelha');
    // Cor própria (não repete a de Estética) e no formato da paleta (#rrggbb).
    expect(sobrancelha.cor).toMatch(/^#[0-9a-f]{6}$/);
    expect(sobrancelha.cor).not.toBe(estetica.cor);
  });

  it('"Sobrancelha/Estética" (legado) continua alias de Estética', () => {
    expect(categoriaInfo('Sobrancelha/Estética').nome).toBe('Estética');
    expect(categoriaInfo('Sobrancelha/Estética').icone).toBe('sparkles');
  });

  it('Restaurante continua utensils-crossed (diferente de Comida)', () => {
    expect(categoriaInfo('Restaurante').icone).toBe('utensils-crossed');
    expect(categoriaInfo('Restaurante').icone).not.toBe(categoriaInfo('Comida').icone);
  });

  it('aliases sem acento/caixa e fallback "Outros"', () => {
    expect(categoriaInfo('lanche').icone).toBe('utensils');
    expect(categoriaInfo('MANICURE').icone).toBe('paintbrush');
    expect(categoriaInfo('Categoria inventada').nome).toBe('Outros');
    expect(categoriaInfo('').icone).toBe('tag');
    expect(categoriaInfo(undefined).icone).toBe('tag');
  });

  it('Sobrancelha aparece no seletor de gasto (Gastei/edição/contas)', () => {
    expect(CATEGORIAS_GASTO.map((c) => c.nome)).toContain('Sobrancelha');
  });

  it('nenhum nome/alias aparece em duas categorias', () => {
    const vistos = new Map<string, string>();
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    for (const c of CATEGORIAS) {
      for (const n of [c.nome, ...(c.aliases ?? [])]) {
        const dono = vistos.get(norm(n));
        if (dono) expect(dono, `${n} em ${dono} e ${c.nome}`).toBe(c.nome);
        vistos.set(norm(n), c.nome);
      }
    }
  });
});
