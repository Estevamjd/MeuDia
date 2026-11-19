# Navegação do MeuDia: pesquisa e decisão (19/11/2026)

Pedido do Estevam: o botão "Mais" na barra de baixo não serve para nada, porque o ☰ no topo já abre o menu.
Ele pediu para trocar por algo útil (Treino), pesquisando antes como organizar finanças, treino e dieta
de um jeito simples. Este documento junta a pesquisa, a decisão e o que foi implementado.

Fontes: a biblioteca Mestres Play (livros 18 e 19, índice) e pesquisa na web. Os links estão no fim.
A pesquisa serviu para aprender, não para copiar: o estilo continua o nosso (v2 Astro G, escuro, ciano).

---

## 1. Resumo em 5 linhas

1. A barra de baixo deve ter **de 3 a 5 destinos**, todos com nome, e servir **só para navegar** (não para ações).
   Apple e Google dizem a mesma coisa. Um "Mais" que repete o ☰ é desperdício de um espaço nobre.
2. **Nova barra:** Início · Treino · Dieta · Relatório. Todo o resto mora no ☰, em 3 grupos curtos:
   Finanças, Saúde e Conta.
3. Assinaturas saiu da barra, mas ganhou um **atalho na Início**. Gastos, Contas, Orçamento, Metas e Bancos
   continuam a 1 toque no ☰. No computador, tudo aparece na barra lateral.
4. Treino e Dieta v1 são **registro rápido + semana + histórico**: 2 toques para anotar, sem contar caloria,
   sem dado inventado. Também aceitam registros pelo WhatsApp ("treinei peito 40min").
5. **Micro-interações escolhidas** (leves e discretas): número que anima ao mudar, vibração curta ao salvar
   (só Android, respeitando "reduzir movimento"), pontinhos da semana com sequência, e esqueleto ao carregar.

---

## 2. O que dizem as regras de design

| Fonte | O que diz | O que fizemos |
|---|---|---|
| **Material 3**, barra de navegação | 3 a 5 destinos, sempre com rótulo, para os destinos principais. Em tela grande, usar trilho ou gaveta. | 4 abas com nome. No computador, barra lateral com tudo. |
| **Apple HIG**, tab bars | Abas servem para navegar, não para executar ações. Menos abas é mais fácil. O "More" automático esconde conteúdo e deve ser evitado. | Sem "Mais". O "Lançar" fica como botão na tela, não como aba. |
| **NN/g**, menus escondidos | Navegação escondida (hambúrguer) reduz a descoberta em mais de 20%. Coloque o que é usado todo dia à vista. | O uso diário (Início, Treino, Dieta) fica visível. O que é mensal ou de configuração vai para o ☰. |

**Conclusão:** um ☰ no topo **mais** um "Mais" embaixo eram duas portas para o mesmo lugar. Trocamos uma delas
por um destino de uso diário.

---

## 3. Como apps parecidos se organizam (benchmark)

### 3.1 Abas de apps de referência

| App | Abas de baixo | Observação |
|---|---|---|
| Hevy (treino) | Início · Treino · Perfil | Só 3. Histórico e estatísticas ficam no Perfil. |
| MyFitnessPal | "Hoje" virou a tela inicial em 2026 (antes era o Diário) | A mudança irritou muita gente (ver 3.2). |
| Yazio | Tirou a aba **Jejum** e a colocou dentro do Diário (2026) | Menos abas, e o recurso continua a 1 toque. |
| Mobills | Principal · Transações · Planejamento · Mais | Tem o "Mais", justamente o que estamos tirando. |
| Google Fit | Início · Diário · Navegar · Perfil | Um "Diário" para os registros. |
| Apple Saúde / Fitness | Resumo · Compartilhar · Navegar | Resumo primeiro e detalhe por baixo. |

**Padrão:** 3 ou 4 abas, uma tela de resumo, registros de uso diário à vista, e o resto agrupado.

### 3.2 O que as pessoas amam e do que reclamam

| App | Amam | Reclamam |
|---|---|---|
| **Organizze** | Interface simples e limpa, lançamento manual rápido. | Sincronização com banco, preço, animação nova lenta. |
| **Mobills** | Muitos recursos, planejamento. | Reclame Aqui "Não recomendada" (mai–out/2026): falhas de sincronização (Open Finance), lançamentos duplicados, pressão para assinar, suporte e cancelamento. |
| **Hevy** | Estatísticas, recordes comemorados, rotinas prontas. | Tela cheia de coisas, recursos sociais barulhentos. Quem quer só registrar prefere o **Strong**, por ser mais simples. |
| **MyFitnessPal** | Banco de alimentos enorme. | Redesign de abr/2026: o diário ficou escondido atrás de "Ver tudo", cards enormes, mais toques para registrar, recursos básicos atrás de assinatura. Não dá para voltar ao layout antigo. |
| **Yazio** | Visual bonito, jejum. | Muitos paywalls e telas de venda. |
| **"Life OS" no Notion** | Tudo num lugar só, do seu jeito. | Vira um projeto de manutenção: muitas páginas, propriedades e fórmulas. As pessoas abandonam em semanas. O que funciona é **uma tela só, com captura sem atrito**. |
| **Bots de finanças no WhatsApp** (Meu Assessor, Poupa.ai, Olivia, ZapGastos, NAIA) | "Gastei 50 no ifood" e pronto. Recibo com **Editar/Desfazer** (Meu Assessor). Apagam os dados a pedido. Não mexem no dinheiro. | Quando entendem errado, corrigir é chato. Alguns pedem acesso ao banco. |
| **SecretárIA** | Finanças, lembretes, treino e alimentação num só WhatsApp, com plano grátis. | Tudo depende do chat: falta uma tela para ver o mês. |
| **YouFit** | Treino e dieta com IA no WhatsApp. | Pago (R$ 37,90/mês) e focado em gerar plano, não em registrar. |

### 3.3 Lições para o MeuDia (sem copiar)

- **Registrar tem que ser o caminho mais curto.** É o que salva o Organizze e o que mais irritou no MyFitnessPal.
  Por isso, nas telas novas, o formulário fica logo depois do resumo, e o WhatsApp vira mais uma porta de entrada.
- **Menos abas e nada duplicado.** Hevy e Yazio cortaram abas. Ninguém elogia o "Mais".
- **App + WhatsApp juntos.** Os bots são ótimos para anotar e fracos para enxergar o mês. O app é o contrário.
  O MeuDia faz os dois: o WhatsApp anota, e o app mostra com o selo "WhatsApp" em cada registro.
- **Nada de paywall nem venda dentro do fluxo.**
- **Sem sincronização bancária por enquanto.** É a maior fonte de reclamação (duplicados, falhas).
  O registro manual ou pelo WhatsApp é previsível.
- **Corrigir fácil.** Cada registro tem excluir com confirmação. No WhatsApp, o v1 responde com um recibo curto.
  "Desfazer" pelo chat fica para a v2 (ver docs/whatsapp.md).

---

## 4. Decisão de navegação (modo Finanças)

```
Celular — barra de baixo (4):   Início   Treino   Dieta   Relatório
Topo:                           ☰ menu · título · assistente

☰ Menu
  Finanças  Gastos · Contas · Assinaturas · Orçamento · Metas · Bancos e carteira
  Saúde     Plano de treino · Calorias e peso
  Conta     Configurações · Sair

Computador — barra lateral
  Finanças  Resumo do mês · Relatório · Gastos · Contas · Assinaturas · Orçamento · Metas · Bancos e carteira
  Saúde     Treino · Dieta · Plano de treino · Calorias e peso
```

| Item | Onde fica | Por quê |
|---|---|---|
| Início (resumo do mês) | Aba 1 | Tela que mais se abre. |
| Treino `/treinos` | Aba 2 | Uso diário. O plano por dia (séries e cargas) virou "Plano de treino" no menu. |
| Dieta `/refeicoes` | Aba 3 | Uso diário, anotar em texto livre. Calorias e peso ficam em "Calorias e peso" (`/saude`). |
| Relatório | Aba 4 | O cartão do mês, o mesmo que o assistente vai mandar. |
| Assinaturas | ☰ + atalho na Início | É de consulta mensal, mas tem atalho visível na Início. |
| Gastos, Contas, Orçamento, Metas, Bancos | ☰ Finanças | Consulta e ajuste, não é uso diário. "Ver todos" na Início leva a Gastos. |
| Configurações | ☰ Conta | Raro. Também é onde se liga o número do WhatsApp. |

**Escalável:** a navegação sai de uma lista só (`apps/web/lib/navegacao.ts`), que é filtrada pelo modo do app.
Um módulo novo entra no ☰ sem mexer na barra. As abas só mudam se o novo destino for de uso diário.

---

## 5. Micro-interações

Pesquisamos as micro-interações em alta e escolhemos só as que ajudam sem poluir a tela.

| Ideia | Decisão | Por quê |
|---|---|---|
| **Número animado** (sobra do mês conta até o valor novo) | ✅ Feito (`NumeroAnimado`) | Mostra que algo mudou. 500 ms com desaceleração, dentro da faixa de 200–500 ms da NN/g. Desliga com "reduzir movimento". O leitor de tela lê só o valor final. |
| **Vibração curta ao salvar** | ✅ Feito (`vibrarLeve`, 12 ms em todo toast de sucesso) | Confirma sem precisar olhar. O Safari/iOS não tem `navigator.vibrate` (MDN), então lá nada acontece. Respeita "reduzir movimento". |
| **Semana em pontinhos + sequência** | ✅ Feito (Treino e Dieta) | Motiva sem pressionar. A sequência só aparece com 2 semanas ou mais, e não há bronca quando ela zera. |
| **Esqueleto ao carregar** | ✅ Já existia, usado nas telas novas | A NN/g recomenda para cargas curtas, de página inteira. |
| Confete ao bater meta | ⏸️ Depois (só uma vez por meta) | Fica bom se for raro. Entra quando Metas tiver o evento "meta atingida". |
| Arrastar para excluir | ⏸️ Depois | Gesto escondido, difícil de descobrir. O botão de lixeira com confirmação é mais claro (e acessível). |
| Sons, mascote, badges | ❌ Não | Viram ruído e destoam do visual sóbrio. |

---

## 6. Custo e escala

- **Banco:** 2 tabelas pequenas (`registros_treino` e `registros_refeicao`), com texto curto, índice por usuário
  e data, e RLS por usuário. Mesmo com uso diário, são poucos KB por pessoa por mês. Dá folga para muitos
  usuários dentro dos 500 MB do plano grátis.
- **Consultas:** cada tela lê só uma janela curta (8 semanas no Treino, 14 dias na Dieta).
- **WhatsApp:** WAHA Core (grátis) no VPS que já existe, com limite de memória. As regras entendem o grosso
  das mensagens sem custo. O Claude Haiku 4.5 é chamado só quando as regras não entendem, e só se houver
  chave configurada. Detalhes em `docs/whatsapp.md`.
- **Vários usuários:** cada número do WhatsApp fica ligado a uma conta (`profiles.whatsapp`, único). A escrita
  passa por uma função do banco que valida o segredo, o número e evita duplicados.

---

## 7. Fontes

Regras de design
- Material 3, Navigation bar: https://m3.material.io/components/navigation-bar/guidelines
- Apple HIG, Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Apple HIG, Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- NN/g, Hamburger menus and hidden navigation: https://www.nngroup.com/articles/hamburger-menus/
- NN/g, Animation duration: https://www.nngroup.com/articles/animation-duration/
- NN/g, Skeleton screens: https://www.nngroup.com/articles/skeleton-screens/
- MDN, Navigator.vibrate (sem suporte no Safari): https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate

Apps e opiniões de usuários
- Hevy, abas e recursos: https://help.hevyapp.com/hc/en-us/articles/35688036014231 · https://www.hevyapp.com/features/track-workouts/
- Hevy vs Strong (Reddit): https://www.reddit.com/r/strongapp/comments/1im2bn8/hevy_vs_strong/ · https://www.reddit.com/r/Hevy/comments/1punfqv/torn_between_strong_and_hevy/
- MyFitnessPal, aba Hoje: https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Your-Today-tab
- MyFitnessPal, reclamações do redesign: https://piunikaweb.com/2026/04/24/myfitnesspal-new-update-complaints/ · https://www.reddit.com/r/Myfitnesspal/comments/1su1sgi/why_the_app_facelift_sucks/
- Yazio, aba Jejum dentro do Diário: https://www.reddit.com/r/yazio/comments/1w0hzy8/fasting_tab/ · https://help.yazio.com/hc/en-us/articles/29421344925585-How-does-the-fasting-tracker-work
- Mobills, Reclame Aqui: https://www.reclameaqui.com.br/empresa/mobills-educacao-financeira/lista-reclamacoes/
- Organizze, Google Play: https://play.google.com/store/apps/details?id=com.organizze.android
- Notion "Life OS" abandonado (Reddit): https://www.reddit.com/r/notioncreations/comments/1vsoh5i/ · https://www.reddit.com/r/Notion/comments/1t4e8is/
- Meu Assessor, recibo com Editar/Desfazer: https://ajuda.meuassessor.com/pt-BR/articles/16141078-como-funcionam-os-botoes-confirmacoes-e-recibos-no-whatsapp
- SecretárIA: https://secretariaai.com/
- YouFit: https://youfitapp.com/

Biblioteca Mestres Play (conteúdo licenciado, não versionado)
- Livro 18 (n8n + API oficial do WhatsApp): webhook único, memória por contato, filtrar só texto de pessoa,
  bloquear loops, passar para humano.
- Livro 19 (conexão não oficial): risco de banimento, usar um chip dedicado (nunca o número pessoal), lista de
  permitidos, bloquear grupos, guardar o mínimo de dados (LGPD).
- Índice: "WhatsApp comum proíbe envio em massa".
