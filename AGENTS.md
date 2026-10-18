# AGENTS.md

Regras para agentes que mexem neste repo. Curto de propósito: o que pode ser checado por máquina está no código, nos testes ou no CI, não aqui.

## Pronto = verificado

Nenhuma entrega está pronta sem `scripts/verify.sh` passando (type-check, lint, unitários, E2E mock no iPhone 13 WebKit e, com PostgreSQL local, os testes SQL). O CI deve rodar o mesmo script (`scripts/verify.sh static`, `scripts/verify.sh e2e` e `scripts/verify.sh db`); enquanto o workflow novo não estiver no `main`, rode localmente e cole o resultado no PR. Depois de um deploy, rode `scripts/verify.sh smoke https://meudia.vercel.app`. Passo a passo em `.cursor/skills/verify-meudia/SKILL.md`.

Todo bug corrigido ganha um teste ou checagem que falha sem a correção. Prove que falha antes de dizer que pegou.

## Limites

- Nunca use o Supabase real em teste. O E2E usa `apps/web/e2e/mock-supabase` e `e2e/mock-guard.ts` aborta qualquer chamada a `*.supabase.co`.
- Sem merge, deploy, migration aplicada ou mudança de env sem OK do dono.
- Nunca imprima segredos. Rode `gitleaks` antes do push.

## Tabela de regras

| Regra | O que garante |
| --- | --- |
| `APP_MODE` é lido em runtime, não congelado no build | `noStore()` em `app/layout.tsx` + `e2e/modo-runtime.spec.ts` (build sem env, start com env) |
| Onboarding concluído não volta para `/onboarding` | `lib/onboarding.ts` (cache `profileKey`) + `e2e/onboarding-loop.spec.ts` |
| Modal não rouba foco ao digitar | `onClose` em ref em `components/ui/Modal.tsx` + `Modal.test.tsx`, `ContasPage.test.tsx` |
| Banner de instalação não cobre a barra inferior | `e2e/novo-usuario.spec.ts` (compara as caixas do banner e da BottomNav) |
| Modais e drawer ficam acima da barra inferior e do banner | portal no `body` em `Modal.tsx`/`NavDrawer.tsx` + clique em Salvar com banner visível em `e2e/novo-usuario.spec.ts` |
| z-index vem de uma escala só; assistente fica acima de BottomNav, banner, header e modais, com X tocável no iPhone | `lib/camadas.ts` (classes `z-<camada>` do Tailwind) + `lib/__tests__/camadas.test.ts` (barra `z-40`/`z-[60]` solto em fixed/sticky) + portal e bottom sheet em `AgentPanel.tsx` + `AgentPanel.test.tsx` + `e2e/assistente.spec.ts` (X no viewport, não coberto, ≥ 44px) |
| SW não recarrega a página na 1ª instalação | Parcial. `e2e/novo-usuario.spec.ts` digita com checagem de foco, mas não há teste dedicado da 1ª instalação do SW |
| Termos e privacidade abrem logado | `lib/__tests__/supabase-middleware.test.ts` |
| Versão do pnpm tem uma fonte só (`packageManager`) | Workflow sem `version:` no `pnpm/action-setup`; com duas fontes o CI quebra com "Multiple versions of pnpm specified" |
| `useAuth` faz um só `getUser()` por aba (estado compartilhado); componente novo nasce com o usuário | `hooks/useAuth.ts` + `hooks/__tests__/useAuth.test.tsx`; medição em `e2e/perf/troca-abas.perf.ts` |
| Troca de aba mostra esqueleto na hora (`loading.tsx` em `(dashboard)` e `(dashboard)/financas`, limite que o `<Link>` pré-carrega) | `e2e/perf/troca-abas.perf.ts` (fora do CI: `pnpm exec playwright test -c playwright.perf.config.ts`) |
| Lint em `ai`, `api` e `mobile` | Nada ainda. Dívida antiga; fora do `verify.sh` até ser limpa (ver PLANO-PIRAMIDE) |

Quando o dono corrigir um agente, conserte e adicione a linha aqui. Se a regra já estava e nada a garantia, suba o conserto para código, tipo, lint ou teste na mesma mudança.

| Regra da revisão de contas/saldo | O que garante |
| --- | --- |
| Histórico de saldo é paginado por chave (data,id) em lotes de 500; schema sem 006 tem erro identificável e logado | `carteiras.repository.test.ts` (várias páginas, max-rows menor, inserção retroativa entre páginas, códigos de schema + log), ordem de deploy no README |
| Lançamento vinculado usa desfazer; nunca edição/exclusão comum, nem direto no banco | `financas.service.test.ts`, `LancamentosVinculados.test.tsx`, `contas-saldo.spec.ts`; triggers da 006 (55000) + `tests/006_carteiras.sql` (UPDATE/DELETE direto bloqueado, desfazer_* da 005/006 ok) em `verify.sh db` |
| Paguei aguarda carteiras e sempre usa uma ativa quando existir | `useFinancasHome.test.ts`, `ProximasContas` desabilita o botão |
| Corrigir saldo usa RPC atômica e chave UUID mantida em retry; chave com outro valor e diferença acima de DECIMAL(10,2) são 400 | `carteiras.service.test.ts`, `useCorrigirSaldo.test.tsx`, `corrigir-saldo.test.ts`, `tests/006_carteiras.sql`, `carteiras.repository.test.ts` (P0002→404, 22023→400) |
| Ajustes não contam no resumo nem nas dicas do agente | `financas.service.test.ts`, `financas.analyzer.test.ts` |
| Onboarding conclui após bancos, com UUID estável e saldo negativo | `Onboarding.test.tsx`, `carteiras.repository.test.ts` |
| Seletores de carteira/categoria navegam por teclado com um único Tab | `RevisaoTeclado.test.tsx` |
| Novo lançamento escolhe carteira ativa quando existir | `NovoLancamento.test.tsx` |
| Editar lançamento antigo (sem carteira) não troca carteira/banco; Salvar não trava se a consulta de carteiras falhar | `NovoLancamento.test.tsx` |
| "No fim do mês sobra" = renda do mês (`rendaDoMes`) − despesas lançadas − contas da competência sem "Paguei"; não soma saldo; Recebi/Paguei não contam em dobro | `sobraDoMes` em `saldo.ts` + `saldo.test.ts`, `ContasSaldo.test.tsx`, `contas-saldo.spec.ts` (aceite 235 / 2.200 / 110) |
| "Em 7 dias você terá" = guardado hoje + "No fim do mês sobra"; os dois cards mostram a conta numa linha visível e respeitam ocultar valores | `emSeteDias` + `saldo.test.ts`, `ContasSaldo.test.tsx`, `contas-saldo.spec.ts` |
| Ajuste de saldo fora de "Gastos por Categoria" do Início | `inicio/__tests__/GastosPorCategoria.test.tsx` |
| Recebi sempre com carteira ativa (padrão arquivada cai na primeira ativa, no front e no banco) | `RecebiSheet.test.tsx`, `useFinancasHome.test.ts`, `tests/006_carteiras.sql` |
| Carteira não se apaga (sem DELETE para authenticated; REVOKE ALL antes dos GRANTs) | `tests/006_carteiras.sql` (com default privileges do Supabase simulados), `carteiras.repository.test.ts` |
| Down da 006 apaga os ajustes antes do DROP COLUMN (exige backup) | `tests/006_carteiras.sql` |
| Onboarding não rebaixa perfil concluído; banco sem id ganha UUID | `Onboarding.test.tsx`, `onboarding.test.ts` |
| E2E não depende da hora real (sessão do mock vale no relógio fixado e no real) | `newSession` em `e2e/mock-supabase/server.mjs` + `contas-saldo.spec.ts` |
