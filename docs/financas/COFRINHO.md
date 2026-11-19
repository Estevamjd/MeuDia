# Sobra do mês e Cofrinho (modelo aprovado em 19/11/2026)

Dois números, duas perguntas diferentes:

| Número | Responde | Onde aparece | Muda com |
| --- | --- | --- | --- |
| **Deve sobrar** (sobra do mês) | "Quanto vai sobrar este mês?" | Início (Resumo do mês) e Relatório | renda, contas fixas e gastos do mês |
| **Cofrinho** | "Quanto eu já tenho guardado?" | linha pequena na Início (abre Bancos) e cartão em Bancos | só ação explícita |
| **Total nos bancos** | "Quanto tem nas contas agora?" | Bancos | todo lançamento com banco |

## Deve sobrar

```
Deve sobrar = Você recebe − Contas fixas − Gastos do mês
```

- **Você recebe**: renda já recebida ("Recebi") + rendas fixas ainda sem "Recebi". Enquanto falta algum "Recebi", a
  Início marca o valor como **previsão**.
- **Contas fixas**: TODAS as contas do mês, pagas ou não. Paga usa o valor do "Paguei"; a pagar, o valor cadastrado.
  A lista mostra "pago em dd/mm" ou "vence dd/mm · a pagar".
- **Gastos do mês**: despesas lançadas no mês, sem ajustes de saldo e **sem** os lançamentos criados por um "Paguei"
  (eles já são a conta fixa). Uma conta paga com data em outro mês (ex.: Celular de novembro pago em 31/10) conta no
  mês da conta, nunca como gasto extra.
- Código: `sobraDoMes` em `packages/shared/src/utils/saldo.ts` (campos `contasFixas`, `totalContasFixas`,
  `gastosExtras`, `previsao`, `valor`). `painelSaldo` entrega `mes.transacoesDeContas` (lançamentos ligados a
  pagamentos) para a conta não contar duas vezes.

## Cofrinho

- Saldo = soma de `cofrinho_movimentos` (migração 014). Histórico só cresce (sem UPDATE/DELETE).
- Movimentos: `inicial` (ponto de partida), `guardar` (+), `tirar` (−, nunca passa do saldo), `corrigir` (diferença
  para o valor informado) e `sobra` (guardar a sobra no fechamento do mês).
- **Gasto não mexe no Cofrinho.** Nem gasto, nem "Paguei", nem "Recebi", nem transferência, nem "Corrigir saldo" de
  banco.
- Ponto de partida: quem já tinha banco na 014 ficou com o Cofrinho que via antes (soma dos bancos "no total" naquele
  dia). Usuário novo: congela no primeiro acesso com banco (`cofrinho_iniciar`).
- RPCs (SECURITY INVOKER, chave de idempotência por toque): `cofrinho_mover`, `cofrinho_corrigir`,
  `cofrinho_fechar_mes`, `cofrinho_iniciar`.

## Fechamento do mês

No último dia do mês, ou no primeiro acesso do mês seguinte, a Início pergunta uma vez:

> Sobrou R$ X em <mês>. Quer guardar no Cofrinho?

- Valor editável. **Guardar** soma ao Cofrinho; **Agora não** só grava a resposta. Fechar no X adia para o próximo
  acesso.
- Uma resposta por mês (`cofrinho_fechamentos`, chave usuário + mês). Repetir não soma de novo.
- Não pergunta de meses antes do Cofrinho começar, nem se não sobrou nada.

## Gastos

"Últimas despesas" mostra primeiro **Contas fixas de <mês>** (todas, com "pago"/"a pagar", total e "Desfazer" do
"Paguei") e depois **Gastos do mês (fora as contas fixas)**: o mesmo número da Início.
