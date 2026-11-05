import { describe, expect, it } from 'vitest';
import type { Profile } from '@meudia/shared';
import { calcularMetas, recalcularMetas } from '@meudia/shared';
import { lerPerfilSaude, paraProfile, perfilVazio, respostasIniciais, salvarPerfilSaude } from '../perfil-saude';

class Memoria implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const respostas = { idade: 28, sexo: 'masculino' as const, alturaCm: 175, pesoKg: 70, nivel: 'moderado' as const, objetivo: 'ganhar' as const };

describe('perfil de saúde sem a 009', () => {
  it('nunca respondeu = null (abre o cadastro); uma chave por conta', () => {
    const s = new Memoria();
    expect(lerPerfilSaude('a', s)).toBeNull();
    salvarPerfilSaude('a', perfilVazio('adiado'), s);
    expect(lerPerfilSaude('a', s)?.estado).toBe('adiado');
    expect(lerPerfilSaude('b', s)).toBeNull();
  });

  it('dado corrompido ou de outra versão = null', () => {
    const s = new Memoria();
    s.setItem('meudia:saude:v1:a', '{quebrado');
    expect(lerPerfilSaude('a', s)).toBeNull();
    s.setItem('meudia:saude:v1:a', JSON.stringify({ versao: 9, estado: 'respondido' }));
    expect(lerPerfilSaude('a', s)).toBeNull();
  });

  it('guarda metas com a origem e lê de volta', () => {
    const s = new Memoria();
    const metas = recalcularMetas(null, calcularMetas(respostas));
    salvarPerfilSaude('a', { ...perfilVazio('respondido'), respostas, metas }, s);
    expect(lerPerfilSaude('a', s)).toMatchObject({ estado: 'respondido', metas: { kcal: 3102, kcalOrigem: 'calculada' } });
  });

  it('profiles recebe altura em metros (validador 0,5–2,5), meta de kcal e objetivo', () => {
    const metas = recalcularMetas(null, calcularMetas(respostas));
    expect(paraProfile(respostas, metas)).toEqual({ peso_atual: 70, altura: 1.75, meta_calorias: 3102, objetivo: 'ganhar_massa' });
    expect(paraProfile({ ...respostas, objetivo: 'manter' }, metas).objetivo).toBe('saude_geral');
  });

  it('pré-preenche com profiles e o último peso', () => {
    const profile = { altura: 1.77, peso_atual: 66.5, objetivo: 'ganhar_massa' } as Profile;
    expect(respostasIniciais(profile, 67.2)).toEqual({ pesoKg: 67.2, alturaCm: 177, objetivo: 'ganhar' });
    expect(respostasIniciais(null, null)).toEqual({ pesoKg: undefined, alturaCm: undefined, objetivo: undefined });
  });
});
