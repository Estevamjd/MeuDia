# Cadastro e onboarding

Uma usuária nova cria conta, passa pelo onboarding um passo por vez e cai na home de Finanças sem voltar ao onboarding.

## Sub-features

- `registro` cria a conta em `/registro`.
- `onboarding-passos` mostra "Passo X de 2" com um botão por vez.
- `onboarding-fim` leva à home e não volta para `/onboarding` após reload.

## How to get to it (user POV)

- Abrir `/registro`, preencher nome, e-mail e senha e criar a conta.
- Login com conta que ainda não fez onboarding abre `/onboarding`.

## Driving it with Playwright (mock)

Preconditions:

- Mock e app no ar (Doctor ok).

- **Fluxo.** Rode `pnpm --filter @meudia/web exec playwright test -c playwright.mock.config.ts e2e/onboarding-loop.spec.ts`. Passa quando a URL final é a home de Finanças e um `page.reload()` não volta para `/onboarding`.
- **Prova.** Prints em `apps/web/e2e/artifacts/onboarding-loop/`.

## Gotchas

- O perfil fica em cache do TanStack Query (`profileKey` em `lib/onboarding.ts`). Navegar antes de atualizar o cache recria o loop do PR #15.
- Use `localhost`, não `127.0.0.1`, para o app: os cookies de sessão seguem o host dos redirects do middleware.
