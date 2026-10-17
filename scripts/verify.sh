#!/usr/bin/env bash
# Verificação do MeuDia: o mesmo comando roda local e no CI (.github/workflows/ci.yml).
# Uso: scripts/verify.sh [static|e2e|all|smoke <url>]
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
  all) static; e2e ;;
  smoke) shift; smoke "$@" ;;
  *) echo "uso: scripts/verify.sh [static|e2e|all|smoke <url>]" >&2; exit 2 ;;
esac
echo "verify: $cmd passou"
