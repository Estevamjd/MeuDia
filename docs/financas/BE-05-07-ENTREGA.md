# BE-05, BE-06 e BE-07 — notas para revisão/PR

Implementados CRUD de rendas/orçamentos, resumo mensal e selo; espelho mensal das assinaturas e invalidação do resumo; inscrição push, lembretes reservados antes do envio, cron autenticado e Paguei por competência.

## Integração

- `orcamentoService.resumoFinanceiroMes(userId, ano, mes, hojeISO?)`: métricas da SPEC, comparação com o mês anterior e selo. Percentuais são frações; comparativo sem base anterior retorna `null`. Contas pagas usam valor/categoria da transação vinculada, mesmo se paga em outro mês.
- `assinaturasService.ASSINATURA_INVALIDACOES`: prefixos que o FE deve invalidar em create/update/delete. Hooks web já consomem a constante. Atualizar/excluir agora recebem `userId` primeiro.
- `POST /api/financas/contas/[id]/pagar`: sessão obrigatória; corpo `{ competencia, pago_em?, banco? }`. `pagar_conta` usa `P0003` para duplicidade; API retorna `COMPETENCIA_JA_PAGA`, HTTP 409. `PGRST116` nas consultas de conta vira `NOT_FOUND`, HTTP 404.
- `POST` e `DELETE /api/push/subscribe`: client isolado por requisição, usuário da sessão; endpoint único por `(user_id, endpoint)` e conflito 23505 tratado.
- Cron pagina inscrições/contas/pagamentos, limita usuários por lote e consulta competência atual e próxima. Só envia ocorrências ativas entre hoje e hoje+2, nunca retroativas. Assinatura não emite push; só sua conta espelho.
- `lembretes_enviados` usa upsert `ignoreDuplicates: true` (ON CONFLICT DO NOTHING) antes de qualquer envio. Falha transitória (sem status, 429 ou 5xx) libera a reserva somente se nenhuma inscrição recebeu com sucesso; sucesso e 404/410 mantêm a reserva; 404/410 removem inscrição; logs não incluem dados da conta ou inscrição.

## Envio real

`web-push` já está instalado e o adapter real está ligado à rota do cron.

O adapter exige `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`, sem fallback. O `.env.example` recebe somente os nomes vazios solicitados: `VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `CRON_SECRET=`. Nenhum `.env` foi lido/criado.

`vercel.json` da raiz do repositório contém a configuração solicitada, sem deploy:

```json
{"crons":[{"path":"/api/cron/lembretes","schedule":"0 12 * * *"}]}
```

Alternativa documental: `pg_cron` + `pg_net` podem chamar a mesma rota às 12:00 UTC, com header `Authorization: Bearer CRON_SECRET` configurado fora do repositório. Nenhum job foi criado.

## Fixture fixa do resumo

Janeiro/2026, hoje 15/01. Renda ativa 1000; orçamento Casa 300/Lazer 100; contas Casa 200+200 e Outros 50. Casa vence dias 5 (paga no prazo) e 10 (vencida); Outros vence dia 25 (já paga, excluída do denominador de prazo). Caixa de janeiro: receita 800/despesa 300. Dezembro: receita 0/despesa 100; aplica fallback da renda prevista.

| Métrica | Esperado |
| --- | ---: |
| rendaPrevista / rendaReal | 1000 / 800 |
| gastoReal / contasMes | 300 / 450 |
| gastoPrevisto | max(300,400)+100+50 = 550 |
| sobraPrevista / sobraReal | 450 / 500 |
| pctComprometida / pagasNoPrazo | 0,45 / 0,50 |
| delta gastoReal absoluto / percentual | 200 / 2 (200%) |
| delta sobraReal absoluto / percentual | -400 / -400÷900 |
| selo | Atenção |

## Validação

- `pnpm turbo run type-check --cache-dir /tmp/tcache`: passou nos cinco pacotes com tarefa configurada.
- `cd apps/web && pnpm lint`: passou; importação de tipo no mock de rotas ajustada para a regra existente.
- `pnpm test`: 529 passaram, 2 falharam, 531 no total. Todos os testes de finanças, push e rotas passaram.
- Falhas fora do escopo, em arquivo não alterado: `packages/ai/src/agent/__tests__/intencao.test.ts`, consultas de carga (`exercicio` esperado `supino`) e agendamento (`dia` esperado `segunda`), ambos retornam `undefined`.
- Roteiro SQL `packages/database/tests/005_financas.sql` atualizado para o novo ERRCODE e unicidade composta. Não executado: banco proibido neste trabalho.
- R6-8: `001_initial_schema.sql` usa a mesma checagem de cobertura SELECT/INSERT/UPDATE/DELETE da 000 antes de criar policies de perfil, user_id direto (incluindo registros_agua) e tabelas filhas; comparação estática dos três guards passou. Baseline não editada.
- R6-3: testes cobrem falhas transitórias com nova tentativa, 404/410, sucesso total/parcial nas duas ordens e falhas em múltiplas inscrições; delete restrito por usuário/conta/competência/etapa/canal e erro do repositório também cobertos.
- Sem banco, rede, deploy, segredos ou comandos git.
