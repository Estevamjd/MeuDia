# Contas e Paguei

A usuária informa a renda do mês, cadastra uma conta com vencimento e marca como paga.

## Sub-features

- `renda` salva a renda pelo sheet "Sua renda do mês".
- `nova-conta` cria conta pelo modal "Nova conta" (Nome, Valor, Dia, Categoria).
- `paguei` marca a conta do mês como paga.

## How to get to it (user POV)

- Home de Finanças, cartão de renda.
- BottomNav, botão "+ Nova conta".
- Lista "Próximas contas", botão "Paguei".

## Driving it with Playwright (mock)

Preconditions:

- Usuária nova com onboarding concluído (o spec cria).

- **Fluxo.** Rode `pnpm --filter @meudia/web exec playwright test -c playwright.mock.config.ts e2e/novo-usuario.spec.ts`. Cada campo é digitado tecla a tecla com checagem de foco (`digitarComFoco`). Passa quando a conta aparece e o "Paguei" muda o status.
- **Prova.** Prints em `apps/web/e2e/artifacts/novo-usuario/`.

## Gotchas

- Valor usa máscara R$. Digite só dígitos (`350000` vira R$ 3.500,00).
- Se o foco sair do campo a cada tecla, o `onClose` do Modal voltou a ser dependência de effect (PR #13).
