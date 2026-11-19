import crypto from 'node:crypto';

// 014 (Cofrinho) no mock: mesmas regras das RPCs em packages/database/migrations/014_cofrinho.sql.
const centavos = (n) => Math.round(n * 100) / 100 + 0;
const duasCasas = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-4;

/** Soma dos bancos ativos "no total" até hoje (cofrinho_total_bancos). */
export function totalBancos({ uid, rowsOf, hojeSP }) {
  const hoje = hojeSP();
  let total = 0;
  for (const c of rowsOf('carteiras').filter((x) => x.user_id === uid && !x.arquivada && x.incluir_no_total)) {
    const dia = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(c.saldo_inicial_em));
    const depois = (t) => t.user_id === uid && t.data <= hoje && (t.data > dia || (t.data === dia && t.created_at > c.saldo_inicial_em));
    total += Number(c.saldo_inicial)
      + rowsOf('transacoes').filter((t) => t.carteira_id === c.id && depois(t)).reduce((v, t) => v + (t.tipo === 'receita' ? 1 : -1) * Number(t.valor), 0)
      + rowsOf('transferencias').filter((t) => (t.origem_id === c.id || t.destino_id === c.id) && depois(t)).reduce((v, t) => v + (t.destino_id === c.id ? 1 : -1) * Number(t.valor), 0);
  }
  return centavos(total);
}

/** `undefined` = não é RPC do Cofrinho. */
export function rpcCofrinho(fn, { uid, args, rowsOf, PgError, hojeSP, nowIso }) {
  const movs = () => rowsOf('cofrinho_movimentos').filter((m) => m.user_id === uid);
  const saldo = () => centavos(movs().reduce((s, m) => s + Number(m.valor), 0));
  const inserir = (m) => {
    const row = { id: crypto.randomUUID(), user_id: uid, competencia: null, chave: null, valor_informado: null, created_at: nowIso(), ...m };
    rowsOf('cofrinho_movimentos').push(row);
    return row;
  };
  const garantirInicial = () => {
    if (!movs().some((m) => m.tipo === 'inicial')) inserir({ tipo: 'inicial', valor: totalBancos({ uid, rowsOf, hojeSP }) });
  };
  const porChave = (chave) => movs().find((m) => m.chave === chave);

  if (fn === 'cofrinho_iniciar') {
    if (rowsOf('carteiras').some((c) => c.user_id === uid)) garantirInicial();
    return saldo();
  }
  if (fn === 'cofrinho_mover') {
    const { p_tipo: tipo, p_valor: valor, p_chave: chave } = args;
    if (!['guardar', 'tirar'].includes(tipo) || !chave || !(valor > 0) || !duasCasas(valor) || valor > 99999999.99) throw new PgError(400, '22023', 'Valor inválido');
    const sinal = tipo === 'guardar' ? valor : -valor;
    const anterior = porChave(chave);
    if (anterior) {
      if (anterior.tipo !== tipo || Number(anterior.valor) !== sinal) throw new PgError(400, '22023', 'Chave já usada com outro valor');
      return [anterior];
    }
    garantirInicial();
    if (tipo === 'tirar' && valor > saldo()) throw new PgError(400, '22023', 'Saldo do Cofrinho insuficiente', { hint: 'cofrinho_insuficiente' });
    return [inserir({ tipo, valor: sinal, chave })];
  }
  if (fn === 'cofrinho_corrigir') {
    const { p_valor_real: real, p_chave: chave } = args;
    if (!chave || typeof real !== 'number' || real < 0 || !duasCasas(real) || real > 99999999.99) throw new PgError(400, '22023', 'Valor inválido');
    const anterior = porChave(chave);
    if (anterior) {
      if (anterior.tipo !== 'corrigir' || Number(anterior.valor_informado) !== real) throw new PgError(400, '22023', 'Chave já usada com outro valor');
      return [anterior];
    }
    garantirInicial();
    const dif = centavos(real - saldo());
    return dif === 0 ? [] : [inserir({ tipo: 'corrigir', valor: dif, chave, valor_informado: real })];
  }
  if (fn === 'cofrinho_fechar_mes') {
    const { p_competencia: comp, p_guardar: guardar, p_valor: valor } = args;
    const hoje = hojeSP();
    const atual = hoje.slice(0, 7);
    const [a, m] = atual.split('-').map(Number);
    const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
    if (comp !== atual && comp !== anterior) throw new PgError(400, '22023', 'Competência inválida', { hint: 'Só o mês atual ou o anterior.' });
    if (typeof guardar !== 'boolean' || (guardar && (!(valor > 0) || !duasCasas(valor)))) throw new PgError(400, '22023', 'Valor inválido');
    const feito = rowsOf('cofrinho_fechamentos').find((f) => f.user_id === uid && f.competencia === comp);
    if (feito) return feito;
    if (guardar) {
      garantirInicial();
      inserir({ tipo: 'sobra', valor, competencia: comp });
    }
    const f = { user_id: uid, competencia: comp, decisao: guardar ? 'guardou' : 'agora_nao', valor: guardar ? valor : null, created_at: nowIso() };
    rowsOf('cofrinho_fechamentos').push(f);
    return f;
  }
  return undefined;
}
