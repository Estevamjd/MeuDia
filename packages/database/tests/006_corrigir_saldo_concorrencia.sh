#!/usr/bin/env bash
# Concorrência real do corrigir_saldo (006): duas sessões corrigem a mesma carteira de 100 para 80 ao mesmo tempo.
# Com o FOR UPDATE na carteira, a segunda espera a primeira e não cria outro ajuste (saldo final 80, não 60).
# SOMENTE Postgres LOCAL DESCARTÁVEL (nunca Supabase). Cria e apaga o banco $DB_TESTE.
# Uso: PGHOST=/tmp PGPORT=55439 PGUSER=postgres bash packages/database/tests/006_corrigir_saldo_concorrencia.sh
set -euo pipefail
export PGOPTIONS='-c client_min_messages=warning'
cd "$(dirname "$0")/.."
DB_TESTE="${DB_TESTE:-meudia_concorrencia_006}"
Q=(psql -v ON_ERROR_STOP=1 -q -X -d "$DB_TESTE")

dropdb --if-exists "$DB_TESTE"
createdb "$DB_TESTE"
trap 'dropdb --if-exists "$DB_TESTE"' EXIT
for f in tests/supabase_stub.sql migrations/000_baseline.sql migrations/005_financas.sql migrations/006_carteiras.sql; do
  "${Q[@]}" -f "$f" >/dev/null
done

USUARIO=c0060000-0000-4000-8000-0000000000c1
CARTEIRA=c0060000-0000-4000-8000-0000000000c2
"${Q[@]}" <<SQL
INSERT INTO auth.users (id, email) VALUES ('$USUARIO', 'conc@example.invalid');
INSERT INTO public.carteiras (id, user_id, nome, saldo_inicial, saldo_inicial_em)
  VALUES ('$CARTEIRA', '$USUARIO', 'Nubank', 100, now() - interval '1 day');
-- Só o estado do Supabase anterior à 006 (tabelas do baseline/005).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes TO authenticated;
SQL

corrigir() {
  "${Q[@]}" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USUARIO', false);
BEGIN;
SELECT count(*) FROM public.corrigir_saldo('$CARTEIRA', 80, gen_random_uuid());
SELECT pg_sleep(1.5);
COMMIT;
SQL
}
corrigir >/dev/null &
p1=$!
sleep 0.5
corrigir >/dev/null &
p2=$!
wait "$p1" "$p2"

resultado="$("${Q[@]}" -At -c "SELECT count(*) || '|' || (100 + coalesce(sum(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0))
  FROM public.transacoes WHERE carteira_id = '$CARTEIRA' AND ajuste")"
if [[ "$resultado" != "1|80.00" ]]; then
  echo "FALHOU: esperado 1 ajuste e saldo 80.00; veio (ajustes|saldo) = $resultado" >&2
  exit 1
fi
echo "ok: correções concorrentes geraram 1 ajuste; saldo final 80.00"
