# BE-05, BE-06 e BE-07 — notas para revisão/PR

Implementados CRUD de rendas/orçamentos, resumo mensal e selo; espelho mensal das assinaturas e invalidação do resumo; inscrição push, lembretes reservados antes do envio, cron autenticado e Paguei por competência.

## Integração

- `orcamentoService.resumoFinanceiroMes(userId, ano, mes, hojeISO?)`: métricas da SPEC, comparação com o mês anterior e selo. Percentuais são frações; comparativo sem base anterior retorna `null`. Contas pagas usam valor/categoria da transação vinculada, mesmo se paga em outro mês.
- `assinaturasService.ASSINATURA_INVALIDACOES`: prefixos que o FE deve invalidar em create/update/delete. Hooks web já consomem a constante. Atualizar/excluir agora recebem `userId` primeiro.
- `POST /api/financas/contas/[id]/pagar`: sessão obrigatória; corpo `{ competencia, pago_em?, banco? }`. `pagar_conta` usa `P0003` para duplicidade; API retorna `COMPETENCIA_JA_PAGA`, HTTP 409. `PGRST116` nas consultas de conta vira `NOT_FOUND`, HTTP 404.
- `POST` e `DELETE /api/push/subscribe`: client isolado por requisição, usuário da sessão; endpoint único por `(user_id, endpoint)` e conflito 23505 tratado.
- Cron pagina inscrições/contas/pagamentos, limita usuários por lote e consulta competência anterior, atual e a de hoje+2. Só envia ocorrências ativas entre hoje e hoje+2, nunca retroativas. Assinatura não emite push; só sua conta espelho.
- `lembretes_enviados` usa upsert `ignoreDuplicates: true` (ON CONFLICT DO NOTHING) antes de qualquer envio. Falha no envio preserva a reserva; 404/410 removem inscrição; logs não incluem dados da conta ou inscrição.

## Pendência para envio real

`web-push` está ausente do lockfile. Nenhuma dependência foi instalada. Pendente no PR: adicionar `web-push` no servidor e fornecer a biblioteca como `WebPushAdapter` a `createPushSender` na rota. A interface e a integração estão cobertas por Vitest com adapter simulado. Até essa instalação/configuração, o cron retorna HTTP 500 antes de criar client administrativo ou reservar lembretes.

O adapter exige `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`, sem fallback. O `.env.example` recebe somente os nomes vazios solicitados: `VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `CRON_SECRET=`. Nenhum `.env` foi lido/criado.

`apps/web/vercel.json` contém a configuração solicitada, sem deploy:

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
- `pnpm test`: 502 passaram, 2 falharam, 504 no total. Todos os testes de finanças, push e rotas passaram.
- Falhas fora do escopo, em arquivo não alterado: `packages/ai/src/agent/__tests__/intencao.test.ts`, consultas de carga (`exercicio` esperado `supino`) e agendamento (`dia` esperado `segunda`), ambos retornam `undefined`.
- Roteiro SQL `packages/database/tests/005_financas.sql` atualizado para o novo ERRCODE e unicidade composta. Não executado: banco proibido neste trabalho.
- Baseline não editada. Sem banco, rede, deploy, segredos ou comandos git.
