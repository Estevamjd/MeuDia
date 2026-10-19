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
| Banner de instalação não cobre conteúdo acionável: enquanto aparece, o `main` reserva o espaço dele (`--reserva-banner`) | `InstallPrompt.tsx` + `app/(dashboard)/layout.tsx` + `e2e/abas.spec.ts` (Gastei da Início clicado com o banner visível, acima dele e da barra) |
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
| Lançamento vinculado usa desfazer; nunca edição/exclusão comum, nem direto no banco. "Excluir" dele chama `desfazer_pagamento`/`desfazer_recebimento` | `financas.service.test.ts`, `LancamentosVinculados.test.tsx`, `useExclusaoLancamento.test.ts` (excluir do Paguei/Recebi), `contas-saldo.spec.ts`; triggers da 006 (55000) + `tests/006_carteiras.sql` e `tests/007_excluir_metas.sql` (UPDATE/DELETE direto bloqueado, desfazer_* ok) em `verify.sh db` |
| Paguei aguarda carteiras e sempre usa uma ativa quando existir | `useFinancasHome.test.ts`, `ProximasContas` desabilita o botão |
| Corrigir saldo usa RPC atômica e chave UUID mantida em retry; chave com outro valor e diferença acima de DECIMAL(10,2) são 400 | `carteiras.service.test.ts`, `useCorrigirSaldo.test.tsx`, `corrigir-saldo.test.ts`, `tests/006_carteiras.sql`, `carteiras.repository.test.ts` (P0002→404, 22023→400) |
| Ajustes não contam no resumo nem nas dicas do agente | `financas.service.test.ts`, `financas.analyzer.test.ts` |
| Onboarding conclui após bancos, com UUID estável e saldo negativo | `Onboarding.test.tsx`, `carteiras.repository.test.ts` |
| Seletores de carteira/categoria navegam por teclado com um único Tab | `RevisaoTeclado.test.tsx` |
| Novo lançamento escolhe carteira ativa quando existir | `NovoLancamento.test.tsx` |
| Editar lançamento antigo (sem carteira) não troca carteira/banco; Salvar não trava se a consulta de carteiras falhar | `NovoLancamento.test.tsx` |
| "No fim do mês sobra" = renda do mês (`rendaDoMes`) − despesas lançadas − contas da competência sem "Paguei"; não soma saldo; Recebi/Paguei não contam em dobro | `sobraDoMes` em `saldo.ts` + `saldo.test.ts`, `ContasSaldo.test.tsx`, `contas-saldo.spec.ts` (aceite 235 / 2.200 / 110) |
| O card "Em 7 dias você terá" saiu (PR #21) e não volta sem pedido do dono; `emSeteDias`/`ancoraPrevisao` não existem mais | `ContasSaldo.test.tsx` (card ausente), `contas-saldo.spec.ts` (previsão A), `excluir-metas.spec.ts` |
| Ajuste de saldo fora de "Gastos por Categoria" do Início | `inicio/__tests__/GastosPorCategoria.test.tsx` |
| Recebi sempre com carteira ativa (padrão arquivada cai na primeira ativa, no front e no banco) | `RecebiSheet.test.tsx`, `useFinancasHome.test.ts`, `tests/006_carteiras.sql` |
| Carteira só se apaga por `carteirasRepository.remove` (DELETE para authenticated veio na 007; REVOKE ALL antes dos GRANTs) | `carteiras.repository.test.ts` (varredura: nenhum outro `.from('carteiras').delete(`), `carteiras.service.test.ts`, `tests/006_carteiras.sql` e `tests/007_excluir_metas.sql` (grants com default privileges do Supabase simulados) |
| Excluir banco não muda o saldo dos outros: lançamentos/rendas viram "Sem banco" e a transferência fica com o lado do banco excluído NULL | `tests/007_excluir_metas.sql` (FKs `SET NULL`, saldos de Caixa/Itaú iguais antes e depois), `saldo.test.ts` (banco excluído, lado NULL), `carteiras-ui.test.ts`, `excluir-metas.spec.ts` |
| Transferência pode ter um lado NULL, nunca os dois (excluir o 2º banco apaga a transferência) | CHECK + `preparar_exclusao_carteira` da 007 + `tests/007_excluir_metas.sql` |
| Toda exclusão (lançamento, transferência, banco, renda, meta) passa por `ConfirmarExclusao` ("Isso não pode ser desfeito."); nada some antes de confirmar | `useExclusaoLancamento.test.ts` (confirmação e nada some antes de confirmar), `excluir-metas.spec.ts` (em Gastos) (lançamento, transferência, banco, meta). Renda: só a tela usa `ConfirmarExclusao`, sem teste da confirmação |
| Excluir renda invalida `['vinculos-transacoes']` (o recebimento cai em cascata e o selo "Recebi" tem de sumir) | `chavesAfetadasPorExclusaoDeRenda` + `hooks/__tests__/useOrcamento.test.ts` (`useExcluirRenda`), `tests/007_excluir_metas.sql` |
| Down da 006 apaga os ajustes antes do DROP COLUMN (exige backup) | `tests/006_carteiras.sql` |
| Onboarding não rebaixa perfil concluído; banco sem id ganha UUID | `Onboarding.test.tsx`, `onboarding.test.ts` |
| E2E não depende da hora real (sessão do mock vale no relógio fixado e no real) | `newSession` em `e2e/mock-supabase/server.mjs` + `contas-saldo.spec.ts` |
| Metas mostram progresso inteiro para baixo (máx. 100), calculado em centavos inteiros (sem erro de ponto flutuante); falta e conclusão sem sugestão | `MetaCard.tsx` + `metas/__tests__/Metas.test.tsx` (500/3.000 = 16%, 570/1.000 = 57%, 290/1.000 = 29%, guardado acima do alvo) + `e2e/excluir-metas.spec.ts` |
| Barra do modo Finanças = 5 abas fixas (Início, Gastos, Metas, Bancos, Config) com rótulo, ícone lucide, ≥ 44px, safe-area e `aria-current`; "+" virou "Gastei" (Início e Gastos), Contas/Orçamento no menu lateral, Chat no ícone do header; `isNavAtivo` ignora query string; ações de linha (editar/excluir) ≥ 44×44 | `lib/__tests__/navegacao.test.ts`, `LancamentosVinculados.test.tsx` + `e2e/abas.spec.ts` |
| Início resumida só com Cofrinho → No fim do mês sobra (com barra) → Contas a vencer (até 2 + "A receber") → 3 últimos gastos, e cabe em 390×844 sem rolar | `FinancasHome.test.tsx` (ordem, uma sobra só) + `e2e/abas.spec.ts` (último bloco acima da barra, scrollHeight ≤ innerHeight) |
| "Entrou" separa salário (receita do mês ligada a `recebimentos_renda.transacao_id`, de qualquer competência: Recebi atrasado ou antecipado) de extras; nada de "Sobra do mês"/"Prevista" fora do `sobraDoMes` | `entradasDoMes` em `utils/gastos.ts` + `gastos.test.ts`, `orcamento.service.test.ts`, `gastos/__tests__/Analise.test.tsx`, `e2e/abas.spec.ts` (cenário do print) |
| Comparação com o mês anterior só quando ele tem lançamento não-ajuste (senão "Primeiro mês no app") | `vsMesAnterior: null` em `resumoFinanceiroMes` + `orcamento.service.test.ts`, `Analise.test.tsx`, `e2e/abas.spec.ts` |
| "Pagas em dia" só conta contas com vencimento ≥ cadastro da conta e ≥ âncora mais antiga das carteiras; sem elegíveis = "—" | `pagasEmDia` + `gastos.test.ts`, `orcamento.service.test.ts` |
| "Baixar meus dados" exporta só os dados de quem está logado: rota com o cliente da sessão (cookies + RLS), nunca service_role; `eq('user_id', uid)` explícito em toda tabela; sem id, user_id, chaves de idempotência nem push | `app/api/financas/exportar/route.ts` + `app/api/__tests__/exportar.test.ts` (401, cliente sem RLS filtrado só pelo `eq`, sem `createClient`, paginação por chave `id` até a página vazia: max-rows 500 e exclusão entre páginas, 500 sem CSV parcial) + `e2e/config.spec.ts` (CSV do A sem nada do B) |
| CSV para Excel pt-BR: UTF-8 com BOM, `;`, decimal com vírgula, datas AAAA-MM-DD, RFC 4180; texto que começa com `= + - @` tab/CR ganha `'` (números não); só colunas listadas em `exportar-dados.ts` | `lib/__tests__/exportar-dados.test.ts` |
| Orçamento tem uma sobra só: "No fim do mês sobra" (`sobraDoMes`); `sobraPrevista` não existe mais e o selo usa `sobraDoMes` | `selo.test.ts`, `orcamento.service.test.ts` (PR A2), `financas/orcamento/__tests__/Orcamento.test.tsx`, `e2e/config.spec.ts` |
| Sobrancelha é categoria própria (`eye`), fora dos aliases de Estética ("Sobrancelha/Estética" segue em Estética); Comida = `utensils`, Unha = `paintbrush`, Restaurante = `utensils-crossed`; todo ícone do mapa existe no lucide-react instalado | `constants/__tests__/categorias.test.ts`, `components/financas/__tests__/CategoriaIcone.test.tsx` (`data-icone`), `e2e/config.spec.ts` |
| Config (Finanças) em ordem: Perfil (nome; dia do salário da renda principal) → Categorias → Notificações → Privacidade (+ Baixar meus dados) → Sair → Zona de perigo igual à de antes | `rendaPrincipal` + `renda-principal.test.ts`, `configuracoes/__tests__/Configuracoes.test.tsx`, `e2e/config.spec.ts` |
