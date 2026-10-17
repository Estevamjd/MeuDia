---
name: verify-meudia
description: "Verifica o MeuDia (PWA Next.js, modo Finanças) do jeito que a usuária usa: build de produção, mock do Supabase e iPhone 13 WebKit. Use antes de dizer que qualquer mudança no MeuDia está pronta, depois de um deploy (smoke) ou quando algo no app parecer quebrado."
---

# Verificar o MeuDia

Rode isto antes de dizer "pronto". Uma entrega sem esta verificação passando não está pronta.

## Launch

Na raiz do repo, com dependências instaladas (`pnpm install --frozen-lockfile`):

```bash
export COREPACK_HOME="$HOME/.cache/corepack"   # só se o corepack não tiver escrita em /usr/local/share
scripts/verify.sh            # static + e2e (+ db se houver PostgreSQL local), o mesmo que o CI deve rodar
scripts/verify.sh static     # type-check, lint (web, shared) e unitários
scripts/verify.sh e2e        # E2E mock
scripts/verify.sh db         # Postgres descartável: stub + testes SQL da 005/006 e concorrência do corrigir_saldo (PG_BIN opcional)
```

O `e2e` sobe sozinho, pelo `webServer` de `apps/web/playwright.mock.config.ts`:

- mock do Supabase em `http://127.0.0.1:54329` (pronto quando `/__mock/health` responde);
- build de produção **sem** `APP_MODE` e `next start` em `http://localhost:3105` **com** `APP_MODE=financas` (pronto quando `/login` responde).

O Playwright encerra os dois servidores ao terminar. Não há dados persistentes: o mock vive em memória.

## Doctor

Antes de dirigir, ou quando algo parecer estranho:

```bash
curl -fsS http://127.0.0.1:54329/__mock/health && echo mock-ok
curl -fsS http://localhost:3105/login | grep -Eq 'mode\\?":\\?"financas' && echo app-financas-ok
ss -ltnp | grep -E ':(54329|3105)\b'
```

Se as portas 54329 ou 3105 já estão ocupadas por um processo que esta execução não iniciou, pare. O config usa `reuseExistingServer: false` e falha de propósito. Não mate o processo de outro agente.

## Drive

Specs em `apps/web/e2e/`, rodados por `playwright.mock.config.ts` (projeto `iphone13-webkit`, locale `pt-BR`, fuso `America/Sao_Paulo`):

- `modo-runtime.spec.ts` prova que `/login` traz `mode":"financas"` lido em runtime.
- `onboarding-loop.spec.ts` faz cadastro, onboarding e chega na home sem voltar para `/onboarding`.
- `novo-usuario.spec.ts` faz o fluxo completo de uma usuária nova (mapa em `features/`).

Para rodar um spec só: `pnpm --filter @meudia/web exec playwright test -c playwright.mock.config.ts e2e/<spec>.spec.ts`.

Todo spec importa `test` de `./mock-guard`, nunca de `@playwright/test`. O guard aborta e reprova qualquer chamada a `*.supabase.co`. Prefira `getByRole`/`getByLabel` com os nomes em pt-BR que a usuária vê.

Depois de um deploy em produção (feito pelo dono), rode o smoke:

```bash
scripts/verify.sh smoke https://meudia.vercel.app
```

## Evidence

- Prints e logs dos specs ficam em `apps/web/e2e/artifacts/<spec>/` (ignorado pelo git).
- Falhas guardam trace em `apps/web/e2e/artifacts/test-results/` (`pnpm --filter @meudia/web exec playwright show-trace <trace.zip>`).
- No CI (com o workflow que roda `scripts/verify.sh e2e`), a pasta inteira sobe como artefato `e2e-mock-artifacts`.

Padrão de prova: caminho real da usuária (tela, toque, digitação), estado depois da ação e efeito no mock (linha criada). Para bug corrigido, mostre o teste falhando sem a correção e passando com ela.

## Cleanup

O Playwright derruba os servidores que subiu. Se uma execução for interrompida, encerre só os PIDs que você iniciou (veja `ss -ltnp` nas portas 54329 e 3105). Não apague `apps/web/e2e/artifacts/`: é a prova. Nunca rode contra o Supabase real nem com dados da usuária.

## Manutenção

Mapa de funcionalidades em `features/README.md`. Quando o app mudar, atualize o mapa e o spec juntos. Ao corrigir um bug, adicione o teste e a linha na tabela de `AGENTS.md`.
