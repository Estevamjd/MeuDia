# Mapa de verificação do MeuDia (modo Finanças)

Fonte mantida das jornadas da usuária. Leia antes de dirigir o app e use o arquivo da funcionalidade como receita.

## Pré-condições base

- `scripts/verify.sh e2e` (ou o spec isolado) sobe mock em `127.0.0.1:54329` e app em `localhost:3105`.
- Cada execução cria uma usuária nova `maria.<run>@example.test` no mock. Nada é compartilhado entre execuções.
- iPhone 13 WebKit, `pt-BR`, `America/Sao_Paulo`.

## Funcionalidades

- [Cadastro e onboarding](./cadastro-onboarding.md) cobre cadastro, os passos do onboarding e a chegada na home sem loop.
- [Contas e Paguei](./contas-paguei.md) cobre renda do mês, nova conta e marcar como paga.
- [Navegação mobile](./navegacao-mobile.md) cobre BottomNav, drawer, banner de instalação e modais por cima da barra.
