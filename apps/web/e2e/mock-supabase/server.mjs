// Mock STATEFUL (em memória) de Supabase Auth (GoTrue) + PostgREST para os testes E2E.
// Nunca toca um Supabase real. Uso: node e2e/mock-supabase/server.mjs [porta]
// Endpoints de apoio: GET /__mock/state (dump), POST /__mock/reset, GET /__mock/health.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.MOCK_SUPABASE_PORT || 54329);
const JWT_SECRET = 'mock-jwt-secret-nao-usar-em-producao';
const ACCESS_TTL = 3600;
const VERBOSE = !!process.env.MOCK_VERBOSE;

// ─── Estado ──────────────────────────────────────────────────────────────────
let users; // email -> user (com password)
let refreshTokens; // refresh -> { userId, revoked }
let tables; // nome -> rows[]
function reset() {
  users = new Map();
  refreshTokens = new Map();
  tables = Object.create(null);
}
reset();
const rowsOf = (t) => (tables[t] ??= []);

// ─── Schema (subconjunto fiel das migrations usadas pelo modo Finanças) ────────
const nowIso = () => new Date().toISOString();
const hojeSP = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const competenciaSP = (d) => hojeSP(d).slice(0, 7);

/** Defaults de coluna (DEFAULT do SQL). */
const DEFAULTS = {
  profiles: () => ({ nome: null, email: null, avatar_url: null, peso_atual: null, altura: null, meta_peso: null, meta_calorias: 2000, meta_agua: 8, objetivo: null, onboarding_feito: false, created_at: nowIso() }),
  contas_pagar: () => ({ assinatura_id: null, categoria: 'Contas', dia_vencimento: null, mes_vencimento: null, data_vencimento: null, ativo: true, created_at: nowIso(), updated_at: nowIso() }),
  pagamentos_conta: () => ({ transacao_id: null, created_at: nowIso() }),
  rendas: () => ({ dia_recebimento: null, ativo: true, created_at: nowIso(), updated_at: nowIso() }),
  orcamento_categorias: () => ({ created_at: nowIso(), updated_at: nowIso() }),
  transacoes: () => ({ data: hojeSP(), banco: null, automatico: false, created_at: nowIso() }),
  assinaturas: () => ({ icone: null, cor: null, ativo: true, created_at: nowIso() }),
  chat_agente: () => ({ intencao: null, acoes: null, created_at: nowIso() }),
  notificacoes_agente: () => ({ lida: false, created_at: nowIso() }),
};
const COM_UPDATED_AT = new Set(['contas_pagar', 'rendas', 'orcamento_categorias']);

/** Chaves únicas (além do PK `id`). Linhas com algum valor null não conflitam (semântica SQL). */
const UNIQUES = {
  orcamento_categorias: [['user_id', 'categoria']],
  pagamentos_conta: [['conta_id', 'competencia']],
  contas_pagar: [['assinatura_id']],
  push_subscriptions: [['user_id', 'endpoint']],
  lembretes_enviados: [['conta_id', 'competencia', 'etapa', 'canal']],
  registros_agua: [['user_id', 'data']],
  scores_diarios: [['user_id', 'data']],
  preferencias_agente: [['user_id']],
  registros_habito: [['habito_id', 'data']],
};

class PgError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.body = { code, message, details: extra.details ?? null, hint: extra.hint ?? null };
  }
}

/** CHECKs relevantes do schema (005_financas.sql + baseline). */
function checkRow(table, r) {
  const fail = (msg) => {
    throw new PgError(400, '23514', `new row for relation "${table}" violates check constraint`, { details: msg });
  };
  const notNull = (...cols) => {
    for (const c of cols) if (r[c] === null || r[c] === undefined) throw new PgError(400, '23502', `null value in column "${c}" of relation "${table}" violates not-null constraint`);
  };
  if (table === 'contas_pagar') {
    notNull('user_id', 'descricao', 'valor', 'recorrencia');
    if (!(Number(r.valor) > 0)) fail('valor > 0');
    if (!['mensal', 'anual', 'unica'].includes(r.recorrencia)) fail('recorrencia');
    const d = r.dia_vencimento, m = r.mes_vencimento, dt = r.data_vencimento;
    if (d != null && (d < 1 || d > 31)) fail('dia_vencimento');
    if (m != null && (m < 1 || m > 12)) fail('mes_vencimento');
    const ok =
      (r.recorrencia === 'mensal' && d != null && m == null && dt == null) ||
      (r.recorrencia === 'anual' && d != null && m != null && dt == null) ||
      (r.recorrencia === 'unica' && dt != null && d == null && m == null);
    if (!ok) fail('recorrencia x vencimento');
  }
  if (table === 'rendas') {
    notNull('user_id', 'descricao', 'valor');
    if (!(Number(r.valor) > 0)) fail('valor > 0');
    if (r.dia_recebimento != null && (r.dia_recebimento < 1 || r.dia_recebimento > 31)) fail('dia_recebimento');
  }
  if (table === 'orcamento_categorias') {
    notNull('user_id', 'categoria', 'valor_planejado');
    if (!(Number(r.valor_planejado) >= 0)) fail('valor_planejado >= 0');
  }
  if (table === 'transacoes') {
    notNull('user_id', 'tipo', 'categoria', 'descricao', 'valor');
    if (!['receita', 'despesa'].includes(r.tipo)) fail('tipo');
  }
  if (table === 'pagamentos_conta') {
    notNull('conta_id', 'user_id', 'competencia', 'pago_em');
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(r.competencia)) fail('competencia');
  }
}

function checkUnique(table, row, ignore) {
  const rows = rowsOf(table);
  const keys = [['id'], ...(UNIQUES[table] ?? [])];
  for (const cols of keys) {
    if (cols.some((c) => row[c] === null || row[c] === undefined)) continue;
    const dup = rows.find((o) => o !== ignore && cols.every((c) => String(o[c]) === String(row[c])));
    if (dup) {
      throw new PgError(409, '23505', `duplicate key value violates unique constraint "${table}_${cols.join('_')}_key"`, {
        details: `Key (${cols.join(', ')})=(${cols.map((c) => row[c]).join(', ')}) already exists.`,
      });
    }
  }
}

// ─── RLS (auth.uid() = user_id; profiles: auth.uid() = id) ────────────────────
function visible(table, row, uid) {
  if (!uid) return false;
  if (table === 'profiles') return row.id === uid;
  if ('user_id' in row) return row.user_id === uid;
  return true; // tabelas filhas sem user_id (ex.: exercicios): sem RLS própria no mock
}
function assertWritable(table, row, uid) {
  if (!visible(table, row, uid)) {
    throw new PgError(403, '42501', `new row violates row-level security policy for table "${table}"`);
  }
}

// ─── JWT (HS256) ──────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig !== parts[2]) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (p.exp && p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const uidFrom = (req) => {
  const p = verifyJwt(bearer(req));
  return p?.role === 'authenticated' ? p.sub : null;
};

const findUserById = (id) => [...users.values()].find((u) => u.id === id);
function publicUser(u) {
  const { password: _pw, ...rest } = u;
  return rest;
}
function newSession(u, sessionId = crypto.randomUUID()) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ACCESS_TTL;
  const access_token = signJwt({
    aud: 'authenticated', exp, iat, iss: `http://127.0.0.1:${PORT}/auth/v1`, sub: u.id, email: u.email,
    phone: '', app_metadata: u.app_metadata, user_metadata: u.user_metadata, role: 'authenticated',
    aal: 'aal1', amr: [{ method: 'password', timestamp: iat }], session_id: sessionId, is_anonymous: false,
  });
  const refresh_token = crypto.randomBytes(16).toString('hex');
  refreshTokens.set(refresh_token, { userId: u.id, sessionId, revoked: false });
  u.last_sign_in_at = nowIso();
  return { access_token, token_type: 'bearer', expires_in: ACCESS_TTL, expires_at: exp, refresh_token, user: publicUser(u) };
}
const authErr = (status, error_code, msg) => ({ status, body: { code: status, error_code, msg } });

// ─── HTTP util ────────────────────────────────────────────────────────────────
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version',
};
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...CORS, ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

// ─── Auth (GoTrue) ────────────────────────────────────────────────────────────
function handleAuth(req, url, body) {
  const path = url.pathname.replace(/^\/auth\/v1/, '');
  if (path === '/health' || path === '/settings') {
    return { status: 200, body: { external: { email: true }, disable_signup: false, mailer_autoconfirm: true } };
  }
  if (path === '/signup' && req.method === 'POST') {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !email.includes('@')) return authErr(400, 'validation_failed', 'Unable to validate email address: invalid format');
    if (password.length < 6) return authErr(422, 'weak_password', 'Password should be at least 6 characters.');
    if (users.has(email)) return authErr(422, 'user_already_exists', 'User already registered');
    const ts = nowIso();
    const id = crypto.randomUUID();
    const u = {
      id, aud: 'authenticated', role: 'authenticated', email, phone: '', password,
      email_confirmed_at: ts, confirmed_at: ts, last_sign_in_at: ts,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { ...(body?.data || {}), email, email_verified: true, sub: id },
      identities: [], created_at: ts, updated_at: ts, is_anonymous: false,
    };
    users.set(email, u);
    // Trigger on_auth_user_created → handle_new_user()
    rowsOf('profiles').push({
      ...DEFAULTS.profiles(), id,
      nome: body?.data?.nome ?? email.split('@')[0], email,
    });
    // mailer_autoconfirm: devolve sessão direto
    return { status: 200, body: newSession(u) };
  }
  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = users.get(String(body?.email || '').trim().toLowerCase());
      if (!u || u.password !== body?.password) return authErr(400, 'invalid_credentials', 'Invalid login credentials');
      return { status: 200, body: newSession(u) };
    }
    if (grant === 'refresh_token') {
      const rt = refreshTokens.get(body?.refresh_token);
      if (!rt || rt.revoked) return authErr(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      rt.revoked = true;
      const u = findUserById(rt.userId);
      if (!u) return authErr(400, 'user_not_found', 'User not found');
      return { status: 200, body: newSession(u, rt.sessionId) };
    }
    return authErr(400, 'unsupported_grant_type', 'Unsupported grant type');
  }
  if (path === '/user') {
    const p = verifyJwt(bearer(req));
    const u = p && findUserById(p.sub);
    if (!u) return authErr(403, 'bad_jwt', 'invalid JWT: unable to parse or verify signature');
    if (req.method === 'PUT') {
      if (body?.data) u.user_metadata = { ...u.user_metadata, ...body.data };
      if (body?.password) u.password = body.password;
      u.updated_at = nowIso();
    }
    return { status: 200, body: publicUser(u) };
  }
  if (path === '/logout' && req.method === 'POST') {
    const p = verifyJwt(bearer(req));
    if (p) {
      const scope = url.searchParams.get('scope') || 'global';
      for (const rt of refreshTokens.values()) {
        if (rt.userId === p.sub && (scope === 'global' || (scope === 'local' && rt.sessionId === p.session_id))) rt.revoked = true;
      }
    }
    return { status: 204 };
  }
  if (['/resend', '/recover', '/otp'].includes(path)) return { status: 200, body: {} };
  return authErr(404, 'not_found', `mock: rota de auth não implementada: ${req.method} ${path}`);
}

// ─── PostgREST ────────────────────────────────────────────────────────────────
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function coerce(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function cmp(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1; // nulls last
  if (b === null || b === undefined) return -1;
  const na = Number(a), nb = Number(b);
  if (typeof a === 'number' || typeof b === 'number' || (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb) && typeof a !== 'boolean')) {
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
function splitTop(s) {
  // separa por vírgula respeitando parênteses e aspas
  const out = [];
  let depth = 0, quote = false, cur = '';
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === '(') depth++;
    if (!quote && ch === ')') depth--;
    if (!quote && depth === 0 && ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function testOp(val, op, arg) {
  switch (op) {
    case 'eq': return val !== null && val !== undefined && cmp(val, coerce(arg)) === 0;
    case 'neq': return val !== null && val !== undefined && cmp(val, coerce(arg)) !== 0;
    case 'gt': return val != null && cmp(val, arg) > 0;
    case 'gte': return val != null && cmp(val, arg) >= 0;
    case 'lt': return val != null && cmp(val, arg) < 0;
    case 'lte': return val != null && cmp(val, arg) <= 0;
    case 'is': {
      const a = arg.toLowerCase();
      if (a === 'null') return val === null || val === undefined;
      if (a === 'true') return val === true;
      if (a === 'false') return val === false;
      return false;
    }
    case 'in': {
      const list = splitTop(arg.replace(/^\(|\)$/g, '')).map((x) => x.replace(/^"|"$/g, ''));
      return val != null && list.some((x) => cmp(val, coerce(x)) === 0);
    }
    case 'like':
    case 'ilike': {
      const re = new RegExp('^' + arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', op === 'ilike' ? 'i' : '');
      return val != null && re.test(String(val));
    }
    default:
      throw new PgError(400, 'PGRST100', `mock: operador não suportado "${op}"`);
  }
}
function parseCond(col, expr) {
  // expr: "eq.x" | "not.eq.x"
  let neg = false;
  let rest = expr;
  if (rest.startsWith('not.')) {
    neg = true;
    rest = rest.slice(4);
  }
  const i = rest.indexOf('.');
  const op = rest.slice(0, i), arg = decodeURIComponent(rest.slice(i + 1));
  return (row) => testOp(row[col], op, arg) !== neg;
}
function parseLogic(kind, inner) {
  // inner: "(a.eq.1,b.is.null)"
  const parts = splitTop(inner.replace(/^\(|\)$/g, ''));
  const preds = parts.map((p) => {
    const m = /^(and|or|not\.and|not\.or)(\(.*\))$/.exec(p);
    if (m) {
      const neg = m[1].startsWith('not.');
      const f = parseLogic(m[1].replace('not.', ''), m[2]);
      return (r) => f(r) !== neg;
    }
    const dot = p.indexOf('.');
    return parseCond(p.slice(0, dot), p.slice(dot + 1));
  });
  return kind === 'or' ? (r) => preds.some((f) => f(r)) : (r) => preds.every((f) => f(r));
}
function buildFilters(params) {
  const preds = [];
  for (const [k, v] of params) {
    if (RESERVED.has(k)) continue;
    if (k === 'or' || k === 'and') preds.push(parseLogic(k, v));
    else if (k.includes('.')) continue; // filtros em recursos embutidos: ignorados
    else preds.push(parseCond(k, v));
  }
  return (row) => preds.every((f) => f(row));
}
function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(',').map((o) => {
    const [col, ...mods] = o.split('.');
    return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col], bv = b[k.col];
      const an = av === null || av === undefined, bn = bv === null || bv === undefined;
      if (an || bn) {
        if (an && bn) continue;
        // padrão PostgREST: NULLS LAST em asc, NULLS FIRST em desc
        const nullsFirst = k.nullsFirst || (k.desc && !k.nullsFirst && !String(order).includes('nullslast'));
        return an ? (nullsFirst ? -1 : 1) : nullsFirst ? 1 : -1;
      }
      let c = cmp(av, bv);
      if (k.desc) c = -c;
      if (c !== 0) return c;
    }
    return 0;
  });
}
function project(table, row, select, uid) {
  if (!select || select === '*') return { ...row };
  const out = {};
  for (let tok of splitTop(select)) {
    tok = tok.trim();
    if (!tok) continue;
    const emb = /^(?:([\w]+):)?([\w]+)(?:!\w+)?\((.*)\)$/.exec(tok);
    if (emb) {
      // embedding 1:N simplificado — filhos com alguma coluna *_id = row.id
      const [, alias, child, sub] = emb;
      const kids = rowsOf(child).filter((k) => visible(child, k, uid) && Object.entries(k).some(([c, v]) => c.endsWith('_id') && v === row.id));
      out[alias || child] = kids.map((k) => project(child, k, sub, uid));
      continue;
    }
    if (tok === '*') {
      Object.assign(out, row);
      continue;
    }
    const m = /^(?:([\w]+):)?([\w]+)(?:::\w+)?$/.exec(tok);
    if (m) out[m[1] || m[2]] = row[m[2]] ?? null;
  }
  return out;
}
function parsePrefer(req) {
  const p = {};
  for (const part of String(req.headers.prefer || '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k) p[k] = v ?? true;
  }
  return p;
}
function finalize(req, res, table, rows, url, status, { forceRepresentation = false, total } = {}) {
  const prefer = parsePrefer(req);
  const select = url.searchParams.get('select');
  const uid = uidFrom(req);
  const wantsRep = forceRepresentation || req.method === 'GET' || prefer.return === 'representation';
  const accept = String(req.headers.accept || '');
  const headers = {};
  const count = total ?? rows.length;
  if (req.method === 'GET' || req.method === 'HEAD') {
    headers['content-range'] = rows.length ? `0-${rows.length - 1}/${prefer.count ? count : '*'}` : `*/${prefer.count ? count : '*'}`;
  } else {
    headers['content-range'] = `*/${rows.length}`;
  }
  if (req.method === 'HEAD') return send(res, 200, undefined, headers);
  if (!wantsRep) return send(res, status === 200 && req.method !== 'GET' ? 204 : status, undefined, headers);
  const out = rows.map((r) => project(table, r, select, uid));
  if (accept.includes('application/vnd.pgrst.object')) {
    if (out.length !== 1) {
      return send(res, 406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: `The result contains ${out.length} rows`,
        hint: null,
      });
    }
    return send(res, status, out[0], headers);
  }
  return send(res, status, out, headers);
}

function handleRest(req, res, url, body) {
  const table = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\//, ''));
  const uid = uidFrom(req);
  const params = url.searchParams;
  const prefer = parsePrefer(req);

  if (table.startsWith('rpc/')) return handleRpc(req, res, table.slice(4), body, uid);

  const all = rowsOf(table);
  const filter = buildFilters(params);
  const matching = () => all.filter((r) => visible(table, r, uid) && filter(r));

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = applyOrder(matching(), params.get('order'));
    const total = rows.length;
    let offset = Number(params.get('offset') || 0);
    let limit = params.has('limit') ? Number(params.get('limit')) : Infinity;
    const range = /^(\d+)-(\d*)$/.exec(String(req.headers.range || ''));
    if (range) {
      offset = Number(range[1]);
      if (range[2]) limit = Number(range[2]) - offset + 1;
    }
    rows = rows.slice(offset, offset + limit);
    return finalize(req, res, table, rows, url, 200, { total });
  }

  if (req.method === 'POST') {
    const input = Array.isArray(body) ? body : [body ?? {}];
    const upsert = prefer.resolution === 'merge-duplicates' || prefer.resolution === 'ignore-duplicates';
    const conflictCols = (params.get('on_conflict') || 'id').split(',').map((s) => s.trim());
    const affected = [];
    // Valida tudo antes de gravar (transação)
    const staged = [];
    for (const raw of input) {
      if (upsert) {
        const existing = conflictCols.every((c) => raw[c] !== undefined && raw[c] !== null)
          ? all.find((o) => conflictCols.every((c) => String(o[c]) === String(raw[c])))
          : undefined;
        if (existing) {
          if (!visible(table, existing, uid)) throw new PgError(403, '42501', `new row violates row-level security policy (USING expression) for table "${table}"`);
          if (prefer.resolution === 'ignore-duplicates') continue;
          const merged = { ...existing, ...raw };
          if (COM_UPDATED_AT.has(table)) merged.updated_at = nowIso();
          assertWritable(table, merged, uid);
          checkRow(table, merged);
          staged.push({ kind: 'update', target: existing, value: merged });
          continue;
        }
      }
      const row = { id: crypto.randomUUID(), ...(DEFAULTS[table]?.() ?? { created_at: nowIso() }), ...raw };
      assertWritable(table, row, uid);
      checkRow(table, row);
      checkUnique(table, row);
      for (const s of staged) if (s.kind === 'insert' && s.value.id === row.id) throw new PgError(409, '23505', 'duplicate key');
      staged.push({ kind: 'insert', value: row });
    }
    for (const s of staged) {
      if (s.kind === 'insert') {
        all.push(s.value);
        affected.push(s.value);
      } else {
        checkUnique(table, s.value, s.target);
        Object.assign(s.target, s.value);
        affected.push(s.target);
      }
    }
    return finalize(req, res, table, affected, url, 201);
  }

  if (req.method === 'PATCH') {
    const rows = matching();
    const patch = body ?? {};
    const next = rows.map((r) => {
      const v = { ...r, ...patch };
      if (COM_UPDATED_AT.has(table) && !('updated_at' in patch)) v.updated_at = nowIso();
      assertWritable(table, v, uid);
      checkRow(table, v);
      checkUnique(table, v, r);
      return v;
    });
    rows.forEach((r, i) => Object.assign(r, next[i]));
    return finalize(req, res, table, rows, url, 200);
  }

  if (req.method === 'DELETE') {
    const rows = matching();
    tables[table] = all.filter((r) => !rows.includes(r));
    return finalize(req, res, table, rows, url, 200);
  }

  return send(res, 405, { code: 'PGRST', message: 'method not allowed' });
}

// ─── RPCs (fiéis a packages/database/migrations/005_financas.sql) ─────────────
function handleRpc(req, res, fn, args = {}, uid) {
  if (!uid) throw new PgError(401, '42501', `permission denied for function ${fn}`);
  if (fn === 'pagar_conta') {
    const conta = rowsOf('contas_pagar').find((c) => c.id === args.p_conta_id && c.user_id === uid);
    if (!conta) throw new PgError(400, 'P0002', 'Conta não encontrada ou acesso negado');
    const comp = args.p_competencia;
    if (!comp || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(comp)) throw new PgError(400, '22023', 'Competência inválida', { hint: 'Exige YYYY-MM.' });
    const criada = competenciaSP(new Date(conta.created_at));
    if (
      !conta.ativo ||
      (conta.recorrencia === 'anual' && Number(comp.slice(5, 7)) !== conta.mes_vencimento) ||
      (conta.recorrencia === 'unica' && comp !== String(conta.data_vencimento).slice(0, 7)) ||
      (['mensal', 'anual'].includes(conta.recorrencia) && comp < criada)
    ) {
      throw new PgError(400, '22023', 'Conta sem ocorrência nesta competência', {
        hint: 'Exige conta ativa e competência compatível com a recorrência e criação.',
      });
    }
    if (rowsOf('pagamentos_conta').some((p) => p.conta_id === conta.id && p.competencia === comp && p.user_id === conta.user_id)) {
      throw new PgError(400, 'P0003', 'Competência já paga', { hint: 'Exige competência sem pagamento.' });
    }
    const pagoEm = args.p_pago_em ?? hojeSP();
    const transacao = {
      id: crypto.randomUUID(), ...DEFAULTS.transacoes(), user_id: conta.user_id, tipo: 'despesa',
      categoria: conta.categoria, descricao: conta.descricao, valor: conta.valor, data: pagoEm,
      banco: args.p_banco ?? null, automatico: true,
    };
    const pagamento = {
      id: crypto.randomUUID(), conta_id: conta.id, user_id: conta.user_id, competencia: comp,
      pago_em: pagoEm, transacao_id: transacao.id, created_at: nowIso(),
    };
    rowsOf('transacoes').push(transacao);
    rowsOf('pagamentos_conta').push(pagamento);
    return send(res, 200, pagamento);
  }
  if (fn === 'desfazer_pagamento') {
    const conta = rowsOf('contas_pagar').find((c) => c.id === args.p_conta_id && c.user_id === uid);
    if (!conta) throw new PgError(400, 'P0002', 'Conta não encontrada ou acesso negado');
    const comp = args.p_competencia;
    if (!comp || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(comp)) throw new PgError(400, '22023', 'Competência inválida', { hint: 'Exige YYYY-MM.' });
    const pag = rowsOf('pagamentos_conta').find((p) => p.conta_id === conta.id && p.competencia === comp && p.user_id === uid);
    if (!pag) throw new PgError(400, '22023', 'Pagamento não encontrado nesta competência', { hint: 'Exige competência paga.' });
    tables.transacoes = rowsOf('transacoes').filter((t) => !(t.id === pag.transacao_id && t.user_id === pag.user_id));
    tables.pagamentos_conta = rowsOf('pagamentos_conta').filter((p) => p.id !== pag.id);
    return send(res, 204);
  }
  throw new PgError(404, 'PGRST202', `Could not find the function public.${fn} in the schema cache`);
}

// ─── Servidor ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (VERBOSE) console.log(req.method, url.pathname + url.search);
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    const body = await readBody(req);

    if (url.pathname === '/__mock/health') return send(res, 200, { ok: true });
    if (url.pathname === '/__mock/reset' && req.method === 'POST') {
      reset();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/__mock/state') {
      return send(res, 200, { users: [...users.values()].map(publicUser), tables });
    }

    if (url.pathname.startsWith('/auth/v1/')) {
      const r = handleAuth(req, url, body);
      return send(res, r.status, r.body);
    }
    if (url.pathname.startsWith('/rest/v1/')) return handleRest(req, res, url, body);
    return send(res, 404, { message: `mock: rota desconhecida ${url.pathname}` });
  } catch (e) {
    if (e instanceof PgError) return send(res, e.status, e.body);
    console.error('[mock-supabase] erro interno', e);
    return send(res, 500, { code: 'MOCK500', message: String(e?.message || e) });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`[mock-supabase] ouvindo em http://127.0.0.1:${PORT}`));
