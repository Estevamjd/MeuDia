#!/usr/bin/env bash
# SOMENTE PostgreSQL local descartável, por socket Unix. Nunca Supabase.
# 60 sessões autenticadas disputam a mesma cota de 50: exatamente 50 passam.
# Uso: PGHOST=/tmp/pg-descartavel PGPORT=55439 PGUSER=postgres bash packages/database/tests/016_cota_concorrencia.sh
set -euo pipefail
export PGOPTIONS='-c client_min_messages=warning'
cd "$(dirname "$0")/.."

# Recusa conexões TCP e configurações que poderiam redirecionar o teste.
if [[ "${PGHOST:-}" != /* || ! "${PGPORT:-}" =~ ^[0-9]+$ ]]; then
  echo 'FALHOU: teste exige PGHOST de socket Unix local e PGPORT explícitos' >&2
  exit 1
fi
if [[ ! -S "$PGHOST/.s.PGSQL.$PGPORT" ]]; then
  echo 'FALHOU: socket PostgreSQL local não encontrado' >&2
  exit 1
fi
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
DB_TESTE="meudia_cota_016_$$"
RESULTADOS="$(mktemp -d)"
Q=(psql -v ON_ERROR_STOP=1 -q -X -h "$PGHOST" -p "$PGPORT" -U "${PGUSER:-postgres}" -d "$DB_TESTE")

# Sem drop prévio: se o banco já existir, falha em vez de apagar dados.
if ! createdb -h "$PGHOST" -p "$PGPORT" -U "${PGUSER:-postgres}" "$DB_TESTE"; then
  rm -rf "$RESULTADOS"
  exit 1
fi
cleanup() {
  dropdb --if-exists -h "$PGHOST" -p "$PGPORT" -U "${PGUSER:-postgres}" "$DB_TESTE"
  rm -rf "$RESULTADOS"
}
trap cleanup EXIT

"${Q[@]}" -f tests/supabase_stub.sql >/dev/null
"${Q[@]}" -f migrations/000_baseline.sql >/dev/null
for numero in {005..016}; do
  for migration in migrations/"${numero}"_*.sql; do
    [[ "$migration" == *_down.sql ]] && continue
    "${Q[@]}" -f "$migration" >/dev/null
  done
done
USUARIO=c0160000-0000-4000-8000-000000000001
"${Q[@]}" -c "INSERT INTO auth.users(id,email) VALUES ('$USUARIO','cota-concorrencia@example.invalid')" >/dev/null

pids=()
for tentativa in {1..60}; do
  "${Q[@]}" -At >"$RESULTADOS/$tentativa" <<SQL &
SET ROLE authenticated;
SET request.jwt.claim.sub TO '$USUARIO';
BEGIN;
SELECT public.ia_consumir_cota(50)->>'permitido';
-- Mantém a trava por um instante para exercitar sessões disputando a linha.
SELECT pg_catalog.pg_sleep(0.01);
COMMIT;
SQL
  pids+=("$!")
done
falhou=0
for pid in "${pids[@]}"; do
  wait "$pid" || falhou=1
done
[[ "$falhou" == 0 ]] || { echo 'FALHOU: uma sessão concorrente falhou' >&2; exit 1; }

contagem="$(awk '/^true$/ {permitidos++} /^false$/ {negados++} END {print permitidos "|" negados}' "$RESULTADOS"/*)"
quantidade="$("${Q[@]}" -At -c "SELECT quantidade FROM public.ia_uso_diario WHERE user_id='$USUARIO' AND dia=(pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::DATE")"
if [[ "$contagem" != '50|10' || "$quantidade" != '50' ]]; then
  echo "FALHOU: esperado 50 permitidos, 10 negados, quantidade 50; veio $contagem; quantidade $quantidade" >&2
  exit 1
fi
echo 'ok: cota concorrente: 60 pedidos, 50 permitidos, 10 negados, quantidade final 50'
