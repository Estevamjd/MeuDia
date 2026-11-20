# Exclusão de conta (000_baseline + 001–017)

Inventário do SQL versionado; não inspeciona o banco de produção. `C` = ON DELETE CASCADE;
`N(coluna)` = ON DELETE SET NULL apenas nessa coluna. Todas as tabelas abaixo são `public`, salvo indicação.
A exclusão usa **somente** `auth.admin.deleteUser(id)` (hard delete, padrão do SDK).
As FKs fazem a limpeza na mesma transação do DELETE de `auth.users`, inclusive entre schemas.

| Tabela | user_id? | FKs de propriedade e outras FKs | Como apaga |
| --- | --- | --- | --- |
| profiles | não (`id`) | id → auth.users C | cascata auth |
| treinos | sim | user_id → auth.users C | cascata auth |
| exercicios | não | treino_id → treinos C | cascata treino |
| sessoes_treino | sim | user_id → auth.users C; treino_id → treinos C | cascata auth/treino |
| series_realizadas | não | sessao_id → sessoes_treino C; exercicio_id → exercicios C | cascata pais |
| habitos | sim | user_id → profiles C | cascata perfil |
| registros_habito | sim | user_id → profiles C; habito_id → habitos C | cascata perfil/pai |
| transacoes | sim | user_id → profiles C; (carteira_id,user_id) → carteiras N(carteira_id), 006 | cascata perfil |
| assinaturas | sim | user_id → profiles C | cascata perfil |
| compromissos | sim | user_id → profiles C | cascata perfil |
| registros_peso | sim | user_id → profiles C | cascata perfil |
| refeicoes | sim | user_id → profiles C | cascata perfil |
| registros_agua | sim | user_id → auth.users C | cascata auth |
| medicamentos | sim | user_id → profiles C | cascata perfil |
| registro_medicamentos | sim | user_id → profiles C; medicamento_id → medicamentos C | cascata perfil/pai |
| listas_compras | sim | user_id → profiles C | cascata perfil |
| itens_compras | não | lista_id → listas_compras C | cascata lista |
| veiculos | sim | user_id → profiles C | cascata perfil |
| manutencoes | não | veiculo_id → veiculos C | cascata veículo |
| scores_diarios | sim | user_id → profiles C | cascata perfil |
| conquistas | sim | user_id → profiles C | cascata perfil |
| notificacoes_agente | sim | user_id → profiles C | cascata perfil |
| chat_agente | sim | user_id → profiles C | cascata perfil |
| acoes_agente | sim | user_id → profiles C | cascata perfil |
| preferencias_agente | sim (PK) | user_id → profiles C | cascata perfil |
| notas | sim | user_id → auth.users C | cascata auth |
| contas_pagar | sim | user_id → profiles C; (assinatura_id,user_id) → assinaturas N(assinatura_id) | cascata perfil |
| pagamentos_conta | sim | user_id → profiles C; (conta_id,user_id) → contas_pagar C; (transacao_id,user_id) → transacoes N(transacao_id) | cascata perfil/conta |
| rendas | sim | user_id → profiles C; (carteira_id,user_id) → carteiras N(carteira_id) | cascata perfil |
| orcamento_categorias | sim | user_id → profiles C | cascata perfil |
| push_subscriptions | sim | user_id → profiles C | cascata perfil |
| lembretes_enviados | sim | user_id → profiles C; (conta_id,user_id) → contas_pagar C | cascata perfil/conta |
| carteiras | sim | user_id → profiles C | cascata perfil |
| transferencias | sim | user_id → profiles C; (origem_id,user_id) e (destino_id,user_id) → carteiras N(origem_id)/N(destino_id) desde 007 (NO ACTION em 006) | cascata perfil |
| recebimentos_renda | sim | user_id → profiles C; (renda_id,user_id) → rendas C; (transacao_id,user_id) → transacoes N(transacao_id) | cascata perfil/renda |
| metas | sim | user_id → profiles C | cascata perfil |
| notificacoes_saude_enviadas | sim | user_id → profiles C; origem_id sem FK | cascata perfil |
| registros_treino | sim | user_id → auth.users C | cascata auth |
| registros_refeicao | sim | user_id → auth.users C | cascata auth |
| whatsapp_contatos | sim (nullable) | user_id → auth.users C | cascata auth para contatos vinculados |
| private.whatsapp_envios | sim | user_id → auth.users C; telefone sem FK | cascata auth, sem PostgREST |
| cofrinho_movimentos | sim | user_id → profiles C | cascata perfil |
| cofrinho_fechamentos | sim (PK composta) | user_id → profiles C | cascata perfil |
| ia_uso_diario | sim (PK composta) | user_id → profiles C | cascata perfil |
| perfil_saude | sim (PK) | user_id → profiles C | cascata perfil |
| private.whatsapp_manutencoes | não | nenhuma; só dia da manutenção global | preservada, sem dados da conta |
| private.whatsapp_acoes | sim | user_id → profiles C | cascata perfil, sem PostgREST |
| private.whatsapp_mensagens | não | nenhuma; só id externo e created_at | não há vínculo com conta; retenção de 7 dias na RPC whatsapp_manutencao_diaria |
| private.integracoes | não | nenhuma; configuração global do webhook | preservada, não pertence à conta |

001 repete o schema do baseline, 002 repete agente, 003 repete notas; 004 só policies.
008 acrescenta campos/restrições e notificações; 009 só origem; 012 só fatos/funções;
013 acrescenta preferências e envios. Nenhuma outra FK RESTRICT/NO ACTION permanece nas tabelas inventariadas após 016. A 015 só acrescenta RPCs; a 016 acrescenta perfil_saude, ia_uso_diario e o log privado whatsapp_acoes, todos removidos pela cascata do perfil. A 017 só acrescenta três colunas de parcela, um CHECK e um índice em transacoes; não cria tabelas/FKs nem altera a cascata.

## Triggers e atomicidade

A pré-limpeza por PostgREST é incorreta nas duas ordens: apagar transações antes dos vínculos
falha no commit do pedido HTTP (`trg_vinculo_orfao`); apagar vínculos ainda ligados primeiro
falha imediatamente em `trg_vinculo_proteger`, mesmo com service role.
`proteger_vinculo()` permite RI em cascata (`pg_trigger_depth() > 1`). O constraint trigger
`trg_vinculo_orfao` é **DEFERRABLE INITIALLY DEFERRED**: consulta se o vínculo ainda existe
sem transação no commit. No DELETE de auth.users, perfil, transações e vínculos somem na
mesma transação, portanto não sobra órfão, qualquer que seja a ordem interna das cascatas.
`trg_vinculo_transacoes` só protege UPDATE e também permite cascata; o trigger
`trg_carteiras_preparar_exclusao` da 007 limpa transferências sem lado e o nome do banco,
sem bloquear a exclusão. O Cofrinho limita permissões, sem trigger de DELETE.
O roteiro existente `packages/database/tests/006_carteiras.sql` já cria vínculos vivos,
apaga auth.users e executa `SET CONSTRAINTS ALL IMMEDIATE` (executado somente em PostgreSQL local descartável).

Falha de FK/trigger em deleteUser reverte a transação inteira; a rota retorna 500 e loga
apenas uma categoria fixa. Não há loop nem exclusões HTTP anteriores para deixar dados
pela metade. Falha de transporte pode ter resultado indeterminado: não há retry automático.
O schema private tem acesso revogado (010); não depende de expô-lo na API nem de RPC nova.

## Limite do modelo atual

IDs externos em private.whatsapp_mensagens podem identificar mensagens no provedor, mas
não têm user_id, telefone ou FK. Não existe RPC de exclusão por conta e não é seguro apagar
IDs de terceiros. A retenção de sete dias é executada pela manutenção diária (whatsapp_manutencao_diaria),
não um TTL automático. Contatos com user_id NULL também não são atribuíveis à conta por FK.
Garantir remoção imediata desses resíduos exige desenho SQL aprovado pelo dono; esta
cascata não apaga esses IDs externos sem vínculo. Storage não é inventariado
por estas migrations: objetos de Storage, se houver, podem impedir o hard delete do Auth.
