// RPCs da 015 (packages/database/migrations/015_rpc_saldo_painel.sql), com as mesmas regras do SQL:
// dia da âncora em America/Sao_Paulo; no mesmo dia só conta created_at > saldo_inicial_em (precisão de ms, como
// date_trunc('milliseconds')); sem created_at no mesmo dia não conta; transferência soma no destino e tira da origem
// (lado NULL só afeta o lado que existe); data <= p_ate; só linhas do usuário (auth.uid()).

const COLUNAS = ['id', 'user_id', 'nome', 'tipo', 'saldo_inicial', 'saldo_inicial_em', 'incluir_no_total', 'arquivada', 'ordem', 'created_at', 'updated_at'];
const FORMATO_SP = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });
const diaSP = (iso) => FORMATO_SP.format(new Date(iso));
const ms = (iso) => Math.trunc(Date.parse(iso));
const cents = (v) => Math.round(Number(v) * 100);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function exigirData(v, PgError) {
  if (typeof v !== 'string' || !DATA.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new PgError(400, '22007', `invalid input syntax for type date: "${v}"`);
  }
  return v;
}

/** public.saldos_carteiras_em(p_ate): [{ carteira_id, saldo }] de todas as carteiras do usuário (inclusive arquivadas). */
export function saldosCarteirasEm({ uid, rowsOf }, ate) {
  const movimentos = [];
  for (const t of rowsOf('transacoes')) {
    if (t.user_id !== uid || !t.carteira_id || t.data > ate) continue;
    movimentos.push({ id: t.carteira_id, data: t.data, created_at: t.created_at, valor: t.tipo === 'receita' ? cents(t.valor) : -cents(t.valor) });
  }
  for (const tr of rowsOf('transferencias')) {
    if (tr.user_id !== uid || tr.data > ate) continue;
    if (tr.destino_id) movimentos.push({ id: tr.destino_id, data: tr.data, created_at: tr.created_at, valor: cents(tr.valor) });
    if (tr.origem_id) movimentos.push({ id: tr.origem_id, data: tr.data, created_at: tr.created_at, valor: -cents(tr.valor) });
  }
  return rowsOf('carteiras').filter((c) => c.user_id === uid).map((c) => {
    const dia = diaSP(c.saldo_inicial_em);
    const ancora = ms(c.saldo_inicial_em);
    const soma = movimentos
      .filter((m) => m.id === c.id && (m.data > dia || (m.data === dia && m.created_at != null && ms(m.created_at) > ancora)))
      .reduce((s, m) => s + m.valor, 0);
    return { carteira_id: c.id, saldo: (cents(c.saldo_inicial) + soma) / 100 };
  });
}

/** ASC NULLS LAST. */
const porTempo = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : ms(a) - ms(b));
/** DESC NULLS LAST. */
const recentePrimeiro = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : ms(b) - ms(a));

/** public.resumo_painel_saldo(p_hoje): { carteiras: [carteira + saldo + saldo_fim_mes_anterior], ultima_carteira_id }. */
export function resumoPainelSaldo(ctx, hoje) {
  const { uid, rowsOf } = ctx;
  const fimAnterior = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const hojeS = new Map(saldosCarteirasEm(ctx, hoje).map((s) => [s.carteira_id, s.saldo]));
  const antS = new Map(saldosCarteirasEm(ctx, fimAnterior).map((s) => [s.carteira_id, s.saldo]));
  const minhas = rowsOf('carteiras').filter((c) => c.user_id === uid);
  const carteiras = [...minhas]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || porTempo(a.created_at, b.created_at))
    .map((c) => ({ ...Object.fromEntries(COLUNAS.map((k) => [k, c[k] ?? null])), saldo: hojeS.get(c.id), saldo_fim_mes_anterior: antS.get(c.id) }));
  const ativas = new Set(minhas.filter((c) => !c.arquivada).map((c) => c.id));
  const desde = minhas.map((c) => diaSP(c.saldo_inicial_em)).sort()[0];
  const ultima = desde === undefined ? undefined : rowsOf('transacoes')
    .filter((t) => t.user_id === uid && !t.ajuste && t.carteira_id && ativas.has(t.carteira_id) && t.data >= desde)
    // ORDER BY created_at DESC NULLS LAST, data ASC, id ASC
    .sort((a, b) => recentePrimeiro(a.created_at, b.created_at) || a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)))[0];
  return { carteiras, ultima_carteira_id: ultima?.carteira_id ?? null };
}

/** Despacho do handleRpc; `undefined` = não é RPC da 015. */
export function rpcSaldoPainel(fn, { uid, args, rowsOf, PgError }) {
  if (fn === 'saldos_carteiras_em') return saldosCarteirasEm({ uid, rowsOf }, exigirData(args.p_ate, PgError));
  if (fn === 'resumo_painel_saldo') return resumoPainelSaldo({ uid, rowsOf }, exigirData(args.p_hoje, PgError));
  return undefined;
}
