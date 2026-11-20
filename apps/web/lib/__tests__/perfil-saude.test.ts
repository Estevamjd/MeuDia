import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@meudia/shared';
import { calcularMetas, recalcularMetas } from '@meudia/shared';
import {
  MENSAGEM_ERRO_CADASTRO_SAUDE,
  OperacaoCancelada,
  carregarPerfilSaudeRemoto,
  criarAdiadoSeAusente,
  gravarCadastroSaude,
  gravarCamposSaude,
  guardarPerfilSaudeLocal,
  lerPerfilSaude,
  paraProfile,
  perfilParaRow,
  perfilVazio,
  podeGravarPerfil,
  respostasIniciais,
  rowParaPerfil,
  serializarPerfil,
  sincronizarPerfilSaude,
  tabelaAusente,
  type EstadoPerfilSaude,
  type PerfilSaude,
} from '../perfil-saude';
import { BancoFalso, Memoria } from './perfil-saude-banco-falso';

const respostas = { idade: 28, sexo: 'masculino' as const, alturaCm: 175, pesoKg: 70, nivel: 'moderado' as const, objetivo: 'ganhar' as const };

describe('cache local do perfil de saúde', () => {
  it('nunca respondeu = null (abre o cadastro); uma chave por conta', () => {
    const s = new Memoria();
    expect(lerPerfilSaude('a', s)).toBeNull();
    guardarPerfilSaudeLocal('a', perfilVazio('adiado'), s);
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
    guardarPerfilSaudeLocal('a', { ...perfilVazio('respondido'), respostas, metas }, s);
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

// ─── Conta (perfil_saude, 016) + cache ───────────────────────────────────────

const metas = recalcularMetas(null, calcularMetas(respostas));
const perfil = (atualizadoEm: string, extra: Partial<PerfilSaude> = {}): PerfilSaude => ({
  ...perfilVazio('respondido'), respostas, metas, atualizadoEm, ...extra,
});
const semear = (banco: BancoFalso, p: PerfilSaude, userId = 'a') => banco.semear(userId, perfilParaRow(userId, p));
const comLocal = (p: PerfilSaude) => {
  const s = new Memoria();
  s.setItem('meudia:saude:v1:a', JSON.stringify(p));
  return s;
};
const respostasB = { ...respostas, pesoKg: 82, idade: 40 };
const metasB = recalcularMetas(null, calcularMetas(respostasB));

afterEach(() => {
  vi.useRealTimers();
});

describe('linha de perfil_saude (contrato da 016)', () => {
  it('ida e volta: respostas/metas JSONB, prazo_meta, ritmo_pct NUMERIC em texto, updated_at = atualizadoEm', () => {
    const p = perfil('2026-11-12T10:00:00.000Z', { prazoMeta: '2027-03-01', ritmoPct: 0.25 });
    const r = { ...perfilParaRow('a', p), updated_at: p.atualizadoEm };
    expect(Object.keys(perfilParaRow('a', p)).sort()).toEqual(['estado', 'formula_versao', 'metas', 'prazo_meta', 'respostas', 'ritmo_pct', 'user_id']);
    expect(rowParaPerfil({ ...r, ritmo_pct: String(r.ritmo_pct) })).toEqual(p);
  });

  it('tabela ausente = PGRST205, 42P01 ou 404; outros erros não', () => {
    expect(tabelaAusente({ code: 'PGRST205' })).toBe(true);
    expect(tabelaAusente({ code: '42P01' })).toBe(true);
    expect(tabelaAusente({ code: '' }, 404)).toBe(true);
    expect(tabelaAusente({ code: '42501' }, 403)).toBe(false);
    expect(tabelaAusente(null, 404)).toBe(false);
  });

  it('só grava com estado conhecido', () => {
    expect((['conta', 'ausente', 'sem_tabela', 'indisponivel', null] as const).map((f) => podeGravarPerfil(f))).toEqual([true, true, true, false, false]);
  });
});

describe('carga (sincronizarPerfilSaude)', () => {
  it('linha na conta vence o cache, mesmo com o relógio do aparelho adiantado (cache "do futuro")', async () => {
    const banco = new BancoFalso();
    semear(banco, perfil('x', { prazoMeta: '2027-03-01' }));
    const s = comLocal(perfil('2099-01-01T00:00:00.000Z', { respostas: respostasB, metas: metasB, estado: 'respondido' }));
    const r = await sincronizarPerfilSaude(banco.client, 'a', { storage: s });
    expect(r.fonte).toBe('conta');
    expect(r.perfil).toMatchObject({ metas: { kcal: 3102 }, prazoMeta: '2027-03-01' });
    expect(banco.ops()).toEqual(['select']);
    expect(lerPerfilSaude('a', s)?.metas?.kcal).toBe(3102);
    expect(banco.linhas.get('a')?.respostas).toEqual(respostas);
  });

  it('conta sem linha + perfil antigo no aparelho: INSERT ON CONFLICT DO NOTHING (ignoreDuplicates), nunca merge', async () => {
    const banco = new BancoFalso();
    const s = comLocal(perfil('2026-11-10T10:00:00.000Z'));
    const r = await sincronizarPerfilSaude(banco.client, 'a', { storage: s });
    expect(banco.ops()).toEqual(['select', 'upsert']);
    expect(banco.chamadas[0]?.filtro).toEqual(['user_id', 'a']);
    expect(banco.chamadas[1]?.opcoes).toEqual({ onConflict: 'user_id', ignoreDuplicates: true });
    expect(r).toMatchObject({ fonte: 'conta', perfil: { metas: { kcal: 3102 } } });
    expect(lerPerfilSaude('a', s)?.atualizadoEm).toBe(banco.linhas.get('a')?.updated_at);
  });

  it('dois aparelhos leem "sem linha"; A salva o cadastro; a migração atrasada de B não sobrescreve e B passa a mostrar o de A', async () => {
    const banco = new BancoFalso();
    const sB = comLocal(perfilVazio('adiado'));
    const abrirLeituraB = banco.portao('select');
    const cargaB = sincronizarPerfilSaude(banco.client, 'a', { storage: sB });
    await vi.waitFor(() => expect(banco.ops()).toEqual(['select']));
    // A (aparelho novo) também viu "ausente" e salva o cadastro.
    const sA = new Memoria();
    delete banco.portoes.select;
    const a = await gravarCadastroSaude(banco.client, 'a', { fonte: 'ausente', perfil: null }, { respostas, metas }, { storage: sA });
    expect(a.perfil?.estado).toBe('respondido');
    const linhaA = structuredClone(banco.linhas.get('a'));
    abrirLeituraB();
    const b = await cargaB;
    expect(banco.linhas.get('a')).toEqual(linhaA);
    expect(b).toMatchObject({ fonte: 'conta', perfil: { estado: 'respondido', metas: { kcal: 3102 } } });
    expect(lerPerfilSaude('a', sB)?.estado).toBe('respondido');
  });

  it('nem conta nem aparelho: ausente (confirmado), sem gravar', async () => {
    const banco = new BancoFalso();
    expect(await sincronizarPerfilSaude(banco.client, 'a', { storage: new Memoria() })).toEqual({ fonte: 'ausente', perfil: null });
    expect(banco.ops()).toEqual(['select']);
  });

  it('sem a 016: sem_tabela com o local; sem rede/erro: indisponivel com o cache; nenhum dos dois grava', async () => {
    const local = perfil('2026-11-10T10:00:00.000Z');
    for (const [falha, fonte] of [
      [{ error: { code: 'PGRST205' }, status: 404 }, 'sem_tabela'],
      [{ error: { code: '57014' }, status: 500 }, 'indisponivel'],
      ['rede', 'indisponivel'],
    ] as const) {
      const banco = new BancoFalso();
      banco.falhas.select = falha;
      expect(await sincronizarPerfilSaude(banco.client, 'a', { storage: comLocal(local) })).toEqual({ fonte, perfil: local });
      expect(banco.ops()).toEqual(['select']);
    }
  });

  it('migração que falha: indisponivel com o local, sem lançar (tenta na próxima carga)', async () => {
    const banco = new BancoFalso();
    banco.falhas.upsert = 'rede';
    const local = perfil('2026-11-10T10:00:00.000Z');
    const s = comLocal(local);
    expect(await sincronizarPerfilSaude(banco.client, 'a', { storage: s })).toEqual({ fonte: 'indisponivel', perfil: local });
    expect(lerPerfilSaude('a', s)).toEqual(local);
  });

  it('sinal abortado depois da leitura: lança OperacaoCancelada sem gravar cache nem migrar', async () => {
    const banco = new BancoFalso();
    const ctl = new AbortController();
    const local = perfil('2026-11-10T10:00:00.000Z');
    const s = comLocal(local);
    const abrir = banco.portao('select');
    const carga = sincronizarPerfilSaude(banco.client, 'a', { storage: s, signal: ctl.signal });
    await vi.waitFor(() => expect(banco.ops()).toEqual(['select']));
    ctl.abort();
    abrir();
    await expect(carga).rejects.toBeInstanceOf(OperacaoCancelada);
    expect(banco.ops()).toEqual(['select']);
    expect(lerPerfilSaude('a', s)).toEqual(local);
  });
});

describe('gravações', () => {
  it('ritmo/prazo com linha na conta: UPDATE só da coluna mudada; respostas e metas intactas', async () => {
    const banco = new BancoFalso();
    semear(banco, perfil('x', { prazoMeta: '2027-03-01' }));
    const estado: EstadoPerfilSaude = { fonte: 'conta', perfil: perfilVazio('adiado') }; // cópia velha não importa
    const r = await gravarCamposSaude(banco.client, 'a', estado, { ritmoPct: 0.25 }, { storage: new Memoria() });
    expect(banco.chamadas).toEqual([{ op: 'update', corpo: { ritmo_pct: 0.25 }, filtro: ['user_id', 'a'] }]);
    expect(banco.linhas.get('a')).toMatchObject({ estado: 'respondido', respostas, metas, prazo_meta: '2027-03-01', ritmo_pct: 0.25 });
    expect(r.perfil?.metas?.kcal).toBe(3102);
  });

  it('ritmo com ausência confirmada mas outro aparelho criou antes: insert-only não grava e o UPDATE só muda o ritmo', async () => {
    const banco = new BancoFalso();
    semear(banco, perfil('x'));
    await gravarCamposSaude(banco.client, 'a', { fonte: 'ausente', perfil: null }, { prazoMeta: '2027-05-01' }, { storage: new Memoria() });
    expect(banco.ops()).toEqual(['upsert', 'update']);
    expect(banco.chamadas[0]?.opcoes).toEqual({ onConflict: 'user_id', ignoreDuplicates: true });
    expect(banco.chamadas[1]?.corpo).toEqual({ prazo_meta: '2027-05-01' });
    expect(banco.linhas.get('a')).toMatchObject({ estado: 'respondido', respostas, metas, prazo_meta: '2027-05-01' });
  });

  it('cadastro com linha na conta: UPDATE de estado/respostas/metas/versão; prazo e ritmo ficam', async () => {
    const banco = new BancoFalso();
    semear(banco, { ...perfilVazio('adiado'), prazoMeta: '2027-03-01', ritmoPct: 0.25 });
    const s = new Memoria();
    const r = await gravarCadastroSaude(banco.client, 'a', { fonte: 'conta', perfil: null }, { respostas, metas }, { storage: s });
    expect(Object.keys(banco.chamadas[0]?.corpo ?? {}).sort()).toEqual(['estado', 'formula_versao', 'metas', 'respostas']);
    expect(banco.linhas.get('a')).toMatchObject({ estado: 'respondido', prazo_meta: '2027-03-01', ritmo_pct: 0.25 });
    expect(lerPerfilSaude('a', s)).toEqual(r.perfil);
  });

  it('indisponivel (sem rede na carga): não grava e lança a mensagem do cadastro', async () => {
    const banco = new BancoFalso();
    await expect(gravarCamposSaude(banco.client, 'a', { fonte: 'indisponivel', perfil: null }, { ritmoPct: 0.25 })).rejects.toThrow(MENSAGEM_ERRO_CADASTRO_SAUDE);
    expect(banco.chamadas).toEqual([]);
  });

  it('sem a 016: grava só no aparelho', async () => {
    const banco = new BancoFalso();
    const s = new Memoria();
    const r = await gravarCadastroSaude(banco.client, 'a', { fonte: 'sem_tabela', perfil: null }, { respostas, metas }, { storage: s });
    expect(banco.chamadas).toEqual([]);
    expect(r.fonte).toBe('sem_tabela');
    expect(lerPerfilSaude('a', s)?.metas?.kcal).toBe(3102);
  });

  it('falha do banco: mensagem fixa (sem dado de saúde nem erro do banco) e cache intocado', async () => {
    const antes = perfil('2026-11-10T10:00:00.000Z', { estado: 'adiado', respostas: null, metas: null });
    for (const falha of ['rede', { error: { code: 'XX000', message: 'peso 70 kcal 3102' }, status: 500 }] as const) {
      const banco = new BancoFalso();
      semear(banco, antes);
      banco.falhas.update = falha;
      const s = comLocal(antes);
      const erro = await gravarCadastroSaude(banco.client, 'a', { fonte: 'conta', perfil: antes }, { respostas, metas }, { storage: s }).catch((e: Error) => e);
      expect((erro as Error).message).toBe(MENSAGEM_ERRO_CADASTRO_SAUDE);
      expect(lerPerfilSaude('a', s)).toEqual(antes);
    }
  });

  it('"Agora não" (criarAdiadoSeAusente) nunca escreve por cima de uma linha existente', async () => {
    const banco = new BancoFalso();
    semear(banco, perfil('x'));
    const antes = structuredClone(banco.linhas.get('a'));
    const r = await criarAdiadoSeAusente(banco.client, 'a', { storage: new Memoria() });
    expect(banco.linhas.get('a')).toEqual(antes);
    expect(r).toMatchObject({ fonte: 'conta', perfil: { estado: 'respondido' } });
  });
});

describe('serialização e cancelamento (serializarPerfil)', () => {
  it('carga atrasada cancelada não sobrescreve um salvar explícito (banco e cache)', async () => {
    const banco = new BancoFalso();
    const s = comLocal(perfilVazio('adiado')); // perfil antigo: a carga tentaria migrar
    const ctl = new AbortController();
    const abrir = banco.portao('select');
    const carga = serializarPerfil('a', (signal) => sincronizarPerfilSaude(banco.client, 'a', { storage: s, signal }), { signal: ctl.signal });
    await vi.waitFor(() => expect(banco.ops()).toEqual(['select']));
    // Salvar: cancela a carga (como cancelQueries) e entra na fila depois dela.
    ctl.abort();
    const salvar = serializarPerfil('a', (signal) =>
      gravarCadastroSaude(banco.client, 'a', { fonte: 'ausente', perfil: null }, { respostas, metas }, { storage: s, signal }),
    );
    abrir();
    await expect(carga).rejects.toBeInstanceOf(OperacaoCancelada);
    const salvo = await salvar;
    expect(banco.ops()).toEqual(['select', 'upsert']);
    expect(banco.linhas.get('a')).toMatchObject({ estado: 'respondido', respostas, metas });
    expect(lerPerfilSaude('a', s)).toEqual(salvo.perfil);
  });

  it('sem cancelar, a ordem vale: o salvar roda depois da carga e prevalece', async () => {
    const banco = new BancoFalso();
    const s = comLocal(perfilVazio('adiado'));
    const abrir = banco.portao('select');
    const carga = serializarPerfil('a', (signal) => sincronizarPerfilSaude(banco.client, 'a', { storage: s, signal }));
    const salvar = serializarPerfil('a', (signal) =>
      gravarCadastroSaude(banco.client, 'a', { fonte: 'conta', perfil: null }, { respostas, metas }, { storage: s, signal }),
    );
    await vi.waitFor(() => expect(banco.ops()).toEqual(['select']));
    abrir();
    await carga;
    await salvar;
    expect(banco.ops()).toEqual(['select', 'upsert', 'update']);
    expect(banco.linhas.get('a')?.estado).toBe('respondido');
    expect(lerPerfilSaude('a', s)?.estado).toBe('respondido');
  });

  it('operação que nunca termina solta a fila no tempo limite e não tem efeito depois', async () => {
    const banco = new BancoFalso();
    banco.portao('upsert'); // nunca abre
    const s = new Memoria();
    const presa = serializarPerfil('a', (signal) => criarAdiadoSeAusente(banco.client, 'a', { storage: s, signal }), { ms: 50 });
    const depois = serializarPerfil('a', async () => 'andou');
    await expect(presa).rejects.toBeInstanceOf(OperacaoCancelada);
    expect(await depois).toBe('andou');
    expect(lerPerfilSaude('a', s)).toBeNull();
    expect(banco.linhas.size).toBe(0);
  });

  it('carregarPerfilSaudeRemoto: erro desconhecido = falha (nunca lança)', async () => {
    const banco = new BancoFalso();
    banco.falhas.select = { error: { code: '57014' }, status: 500 };
    expect(await carregarPerfilSaudeRemoto(banco.client, 'a')).toEqual({ tipo: 'falha' });
  });
});
