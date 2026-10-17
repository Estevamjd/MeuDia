# Navegação mobile

No iPhone, a barra inferior dá os atalhos, o drawer dá as seções, e nada fixo cobre outra coisa.

## Sub-features

- `bottomnav` Início, Contas, + Nova conta, Orçamento, Chat.
- `drawer` abre pelo hambúrguer, fecha com Esc e devolve o foco.
- `banner-instalar` "Instalar MeuDia" fica acima da BottomNav, sem cobrir.
- `modal-topo` modais ficam por cima da barra e do banner.

## How to get to it (user POV)

- Qualquer tela logada no modo Finanças em largura de iPhone.

## Driving it with Playwright (mock)

Preconditions:

- Usuária logada (o spec `novo-usuario` cria).

- **Fluxo.** O mesmo `e2e/novo-usuario.spec.ts` compara as caixas do banner e da BottomNav e clica em "Salvar" num modal com o banner visível.
- **Prova.** Print `banner-instalar` em `apps/web/e2e/artifacts/novo-usuario/`.

## Gotchas

- O banner só aparece após cerca de 2 s no iOS. Espere o elemento, não um tempo fixo.
- Modal fora de portal herda o stacking context do layout e fica por baixo da barra (PR #17).
