#!/usr/bin/env bash
# Verificação do MeuDia: o mesmo comando roda local e no CI (.github/workflows/ci.yml).
# Uso: scripts/verify.sh [static|e2e|db|all|smoke <url>]
set -euo pipefail
cd "$(dirname "$0")/.."

static() {
  pnpm turbo run type-check
  # Lint só onde já está limpo. ai/api/mobile têm dívida antiga (ver AGENTS.md, tabela de regras).
  pnpm turbo run lint --filter=@meudia/web --filter=@meudia/shared
  pnpm test
}

e2e() {
  # Mock em memória do Supabase + build de produção, iPhone 13 WebKit. Nunca fala com Supabase real.
  pnpm --filter @meudia/web e2e:mock
}

pg_bin() {
  # PG_BIN explícito, senão o pg_config do PATH, senão o maior /usr/lib/postgresql/<versão>/bin (Debian/Ubuntu).
  if [[ -n "${PG_BIN:-}" ]]; then echo "$PG_BIN"; return; fi
  if command -v pg_config >/dev/null && [[ -x "$(pg_config --bindir)/initdb" ]]; then pg_config --bindir; return; fi
  local d
  d="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n1)"
  if [[ -n "$d" && -x "$d/initdb" ]]; then echo "$d"; fi
}

db() {
  # Postgres DESCARTÁVEL (initdb em diretório temporário, socket local, porta livre). Nunca fala com Supabase.
  local bin dir porta
  bin="$(pg_bin)"
  if [[ -z "$bin" ]]; then
    echo "verify db: binários do PostgreSQL não encontrados (defina PG_BIN)" >&2
    return 1
  fi
  dir="$(mktemp -d)"
  porta="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
  "$bin/initdb" -D "$dir/data" -U postgres -A trust --no-sync >/dev/null
  "$bin/pg_ctl" -D "$dir/data" -l "$dir/log" -w \
    -o "-k $dir -p $porta -c listen_addresses='' -c fsync=off" start >/dev/null
  # shellcheck disable=SC2064
  trap "'$bin/pg_ctl' -D '$dir/data' -m immediate stop >/dev/null 2>&1 || true; rm -rf '$dir'" EXIT
  (
    export PATH="$bin:$PATH" PGHOST="$dir" PGPORT="$porta" PGUSER=postgres PGDATABASE=postgres
    export PGOPTIONS='-c client_min_messages=warning'
    local q=(psql -X -q -v ON_ERROR_STOP=1)
    cd packages/database
    "${q[@]}" -f tests/supabase_stub.sql >/dev/null
    # Cada roteiro roda numa transação com ROLLBACK: 005 sozinha; 000 + 005 + 006 (2x) e o down;
    # 000 + 005 + 006 + 007 (2x), os downs 007 (2x) e 006 e o up de novo.
    "${q[@]}" -f tests/005_financas.sql >/dev/null
    "${q[@]}" -f tests/006_carteiras.sql >/dev/null
    "${q[@]}" -f tests/007_excluir_metas.sql >/dev/null
    echo "ok: tests/005_financas.sql, tests/006_carteiras.sql e tests/007_excluir_metas.sql"
    bash tests/006_corrigir_saldo_concorrencia.sh
  )
}

smoke() {
  local url="${1:?uso: scripts/verify.sh smoke https://meudia.vercel.app}"
  local html
  html="$(curl -fsSL --max-time 30 "${url%/}/login")"
  if grep -Eq 'mode\\?":\\?"financas' <<<"$html"; then
    echo "smoke ok: ${url%/}/login contém mode\":\"financas"
  else
    echo "smoke FALHOU: ${url%/}/login não contém mode\":\"financas (APP_MODE congelado ou env ausente)" >&2
    exit 1
  fi
}

cmd="${1:-all}"
case "$cmd" in
  static) static ;;
  e2e) e2e ;;
  db) db ;;
  # db entra no "all" só quando há binários do PostgreSQL na máquina.
  all) static; e2e; if [[ -n "$(pg_bin)" ]]; then db; else echo "verify: db pulado (sem PostgreSQL local)"; fi ;;
  smoke) shift; smoke "$@" ;;
  *) echo "uso: scripts/verify.sh [static|e2e|db|all|smoke <url>]" >&2; exit 2 ;;
esac
echo "verify: $cmd passou"
