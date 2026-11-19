# Assistente do MeuDia no WhatsApp

Estado em 19/11/2026: **pronto, esperando o número.** Falta só ler o QR com o chip do bot e pôr os números
autorizados na lista. O onboarding pelo WhatsApp, a persona de amigo engraçado e a memória curta estão no ar (migrations 011 e 012).

## 1. Como funciona

```
Você no WhatsApp ──► chip do bot (WAHA no VPS) ──webhook assinado──► MeuDia /api/whatsapp/webhook
                                                                      │ 1. confere a assinatura HMAC
                                                                      │ 2. ignora grupo, status, canal, mídia, mensagem própria
                                                                      │ 3. portão: número na lista OU onboarding aberto
                                                                      │ 4. whatsapp_contato: conta a mensagem do dia (limite 30)
                                                                      │ 5a. sem conta → onboarding (5 perguntas) → link
                                                                      │ 5b. com conta → regras → Haiku → whatsapp_registrar
                     ◄──────── resposta curta, no estilo da pessoa ── │ 6. "✅ Anotado…" + 1 dica proativa
```

### 1.1 Conversa de quem ainda não tem conta (onboarding)

Boas práticas seguidas (livros 18/19 da Mestres Play e guias de bots conversacionais): avisar que é IA, dizer
quantas perguntas são, **uma pergunta por vez**, texto livre, "pular" sempre vale, re-perguntar com exemplo no
máximo 1 vez e seguir sem prender, lembrar a etapa e retomar de onde parou.

| Etapa | O bot pergunta (resumo) | Entende (regras primeiro; Haiku só se a regra não entender) |
|---|---|---|
| `inicio` | "Oi, tudo bem? 😊 Eu sou o MeuDia, seu assistente com inteligência artificial… São 5 perguntas rápidas (pode responder "pular"). Como você quer que eu te chame?" | — |
| `nome` | (acima) | "Lia", "meu nome é João", "sou o Caio" |
| `renda` | "Quanto você recebe por mês, mais ou menos?" | "3.500", "uns 3 mil", "4,5k", "R$ 2.800" |
| `objetivo` | "Qual seu principal objetivo agora?" | texto livre (até 160 caracteres) |
| `metas` | "Em que quer minha ajuda: dinheiro, treino, dieta ou tudo?" | palavras ("grana", "academia", "emagrecer", "tudo") |
| `estilo` | "Prefere respostas curtas ou detalhadas? Com ou sem emoji?" | "curtas sem emoji"; sem resposta clara = curto com emoji |
| `link` | "Prontinho, Lia! Para ver tudo no painel, crie sua conta (ou entre) por este link: …" | qualquer mensagem gera um link novo |

O link é `https://meudia…/whatsapp?t=TOKEN`: token de uso único, válido por 7 dias. O banco guarda só o sha256
dele. A página guarda o token, e a pessoa cria a conta (ou entra). Ao chegar no painel, o app chama
`whatsapp_vincular`, que liga o número a `profiles.whatsapp`, copia o nome (se vazio) e a renda (se não
houver renda ativa) e marca o contato como `concluido`. Quem já preencheu Configurações → Seu WhatsApp é
reconhecido direto, sem onboarding.

**Por que não criar a conta pelo próprio bot:** o servidor não tem a service role do Supabase (e não deve
ter). Criar usuário ou mandar link de senha para um e-mail digitado no chat abriria brecha para cadastrar
e-mail de terceiros. O link com token deixa a criação da conta no fluxo normal (e-mail + senha, com
confirmação).

### 1.2 Persona (Haiku 4.5): o amigo engraçado que conhece a pessoa

`apps/web/lib/whatsapp/persona.ts`, no formato "SOUL de uma página" (livro 19):

- MeuDia, assistente com IA, **como um amigo próximo e engraçado**; português do Brasil; alegre, atencioso e
  prático; trata pelo primeiro nome; respostas curtas.
- **Regras de ouro do humor:** leve e carinhoso, uma provocação de brincadeira no máximo; nunca maldoso, nunca
  sermão, nunca culpa. **Nunca comenta corpo, peso ou aparência**, nem chama comida de "errada" ou "pecado":
  fala da meta que a pessoa escolheu, não da pessoa. Varia as piadas (cada chamada sorteia um "ângulo":
  pergunta retórica, narrador esportivo, trocadilho…).
- **Proativo, "faz antes de pedir":** depois de um gasto, mostra quanto resta do orçamento ou avisa de conta que
  vence em até 3 dias. Depois de um treino, comemora a semana. Os números vêm sempre do banco.
- Respeita o estilo salvo: curto ou detalhado, com ou sem emoji (sem emoji, o app remove todos, até os da IA).
- Limites: não move dinheiro, não dá recomendação de investimento nem diagnóstico; nunca inventa números.

#### Comentário de amigo depois de um registro

```
registro (regras) ─► whatsapp_registrar ─► extras: orçamento, conta próxima, semana de treino,
                                           dias sem treino, últimos 5 registros (7 dias)
                 ─► ganchoDaMeta (regra, grátis): o registro cruza com uma meta da pessoa?
                       não ─► só a confirmação (sem IA)
                       sim ─► Haiku escreve UMA frase (até 80 tokens) com meta + fatos + contexto
                              (frase fora do tom ou IA fora do ar ─► texto pronto, sorteado)
                 ─► "🥗 Jantar anotado: Hambúrguer." + a frase
```

| Registro | Meta que precisa existir | Gancho |
|---|---|---|
| Refeição ou gasto com hambúrguer, pizza, refri, doce, cerveja… | `dieta` nas metas ou objetivo como "emagrecer", "secar", "comer melhor" | brincadeira com a meta de alimentação |
| Refeição com salada, grelhado, fruta… | idem | comemora |
| Gasto em Lazer, Comida, Restaurante, Roupa, Streaming… | objetivo de dinheiro ("guardar pra viajar", "sair das dívidas") | cutucada lembrando a meta |
| Gasto que passou do orçamento da categoria | objetivo de dinheiro ou `dinheiro` nas metas | aviso com humor |
| Treino com 2+ dias na semana | `treino` nas metas ou objetivo de treino | comemora a sequência |
| Treino depois de 7+ dias parado | idem | "sumiu, hein" + comemora a volta (só quando a pessoa escreve) |

**Sem meta que combine, não tem comentário nem chamada de IA.** Exemplos reais do Haiku (dados fictícios):

- "comprei um hambúrguer" (meta: emagrecer) → "🥗 Jantar anotado: Hambúrguer. Hambúrguer agora? Alguém tá
  testando a dieta ou a dieta tá testando você? 🍔"
- "gastei 80 no bar com a galera" (meta: juntar dinheiro pra viajar pro Chile; sem emoji) → "Anotado, Lia: gasto
  de R$ 80,00 · Lazer (Bar com a galera). Lia, bar com a galera conta como investimento em memórias pro Chile,
  né? Brincadeira, bora poupar pra lá!"
- "treinei pernas 50min" depois de 9 dias parado (meta: ganhar massa) → "💪 Treino anotado: Pernas · 50 min.
  Boa, Lia! Sumiu do mapa por 9 dias e voltou com tudo nas pernas, hein? 💪"

#### Memória curta (fatos)

"lembra que não gosto de academia de manhã", "sou vegetariana", "não bebo", "acordo 5h"… viram fatos guardados
em `whatsapp_contatos.fatos` (até 10; os mais novos ficam; sem repetir), pela função `whatsapp_lembrar` (migration
012, com o segredo do webhook, só número com conta). Os fatos entram no prompt da conversa e do comentário.
"esquece tudo" apaga. A pessoa lê os próprios fatos pelo RLS; eles somem com a conta.

#### Custo

Haiku 4.5 (US$ 1/M entrada, US$ 5/M saída): comentário ≈ US$ 0,0006 (~380 tokens de entrada, ~40 de saída,
medido); interpretar ≈ US$ 0,002; onboarding ≈ US$ 0,0005; conversa ≈ US$ 0,0015. Regras primeiro: o comentário
só existe quando há gancho com a meta. No pior caso (30 mensagens/dia, todas com IA), fica em ~US$ 0,05 por
pessoa por dia.

Exemplos que já funcionam (sem IA, só com regras):

| Mensagem | Vira |
|---|---|
| `gastei 45,90 no mercado` | Gasto R$ 45,90 · Mercado, no último banco usado |
| `uber 23` / `paguei 120 de luz` | Gasto · Transporte / Luz |
| `recebi 500 do freela` | Entrada · Entrada extra |
| `treinei peito 40min` / `corri 5km 30 min` | Treino (aba Treino) |
| `almocei arroz, feijão, frango` / `comi uma maçã` | Refeição (aba Dieta). O tipo vem do verbo ou da hora |
| `... ontem` | Registra no dia anterior |
| `comprei um hambúrguer` (sem valor) | Refeição (o tipo vem da hora). Com valor (`comprei um hambúrguer 32`) vira gasto · Comida |
| `lembra que não gosto de academia de manhã` / `sou vegetariana` | Fato guardado (memória curta). `esquece tudo` apaga |
| `ajuda` | Mostra exemplos |
| outra coisa ("hoje foi puxado") | Resposta da persona com uma sugestão (se houver chave da Anthropic) |

Tudo o que chega pelo WhatsApp aparece no app com o selo **WhatsApp** (`origem = 'whatsapp'`).

## 2. Por que webhook direto (e não n8n)

| | Webhook no MeuDia (escolhido) | n8n |
|---|---|---|
| Saltos | WAHA → app → banco | WAHA → n8n → app/banco |
| Código | Versionado no git, com testes (parser, onboarding, rota, banco) | Fluxo visual que muda sem revisão |
| Segredos | Ficam no `.env` do app | Mais um lugar com credenciais |
| Custo/memória | Zero extra | O n8n já roda, mas cada fluxo pesa e falha em silêncio |

**Decisão sobre o n8n (19/11/2026): hoje ele não é dono de nada.**

- **Lembretes proativos:** desenhados e **desligados** (ver 7.1). Quando forem ligados, o agendador será o
  cron do próprio app (`/api/cron/lembretes`, que já existe para push), não o n8n, para ficar versionado e testado.
- **Alerta de erro por fluxo n8n: não agora.** Não há fluxo no n8n que possa falhar, e alertar pelo WhatsApp
  seria uma mensagem proativa (risco de banimento). Os erros do webhook ficam no log do container
  (`docker logs meudia-meudia-1 | grep whatsapp`). O healthcheck do Docker reinicia o app.
- **Endurecido:** `N8N_DIAGNOSTICS_ENABLED=false`, `N8N_VERSION_NOTIFICATIONS_ENABLED=false`,
  `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=336` (14 dias). A porta, que estava aberta em HTTP
  numa porta alta pública, agora só escuta em `127.0.0.1` (acesso só por https://n8n-5bnh.srv2176785.hstgr.cloud).
  A chave de criptografia tem cópia em `/workspace/secrets/n8n-encryption-key.txt` (600). Sem ela, as
  credenciais salvas no n8n não abrem se o volume for restaurado em outro lugar. Backup do compose antigo:
  `/docker/n8n-5bnh/docker-compose.yml.bak-20261119`.

O livro 18 da Mestres Play recomenda um webhook único, filtrar só texto de pessoa, bloquear loops e ter
uma memória por contato. Seguimos isso no código: ignoramos grupos, status, canais, mensagens próprias e
mídia, cada mensagem tem deduplicação no banco, e a memória por contato é a tabela `whatsapp_contatos`.

## 3. Segurança e riscos (ler antes de ligar)

- **Conexão não oficial.** O WAHA usa o WhatsApp Web (engine GOWS). Os termos do WhatsApp proíbem uso
  automatizado/não pessoal e **o número pode ser banido** (livro 19 da Mestres Play). Por isso:
  - use um **chip dedicado** ao bot, **nunca** o seu número pessoal;
  - o bot **só responde** a quem escreveu e a quem está na lista. **Nada de envio em massa.**
    Os lembretes proativos estão **desligados**: nenhum código envia mensagem sem alguém ter escrito antes;
  - grupos são ignorados.
- **Portão:** só conversa com quem está em `WHATSAPP_NUMEROS_PERMITIDOS`. Com
  `WHATSAPP_ONBOARDING_ABERTO=true` qualquer número pode fazer o onboarding (padrão: `false`). **Lista vazia e
  onboarding fechado = ninguém escreve.** Quem fica de fora é ignorado em silêncio.
- **Limite por número:** `WHATSAPP_LIMITE_DIA` (padrão 30 mensagens por dia, no fuso de SP). Na 31ª o bot avisa
  uma vez e depois fica quieto até o dia seguinte. Isso protege o custo da IA e o chip.
- **Webhook assinado:** o WAHA assina cada evento com HMAC-SHA512. Sem assinatura válida a rota responde 401.
  Sem a chave configurada, a rota fica desligada (503).
- **Banco sem service role:** o app grava pela função `public.whatsapp_registrar` (SECURITY DEFINER). Ela exige
  um segredo, do qual o banco guarda só o hash sha256 em `private.integracoes`. Ela também exige que o número
  esteja ligado a uma conta em `profiles.whatsapp`, e descarta mensagens repetidas por 7 dias. O onboarding usa
  `whatsapp_contato` e `whatsapp_onboarding`, com o mesmo segredo. O vínculo usa `whatsapp_vincular`, só para
  usuário logado e com o token. A tabela `whatsapp_contatos` tem RLS: cada pessoa só lê o próprio contato, e
  ninguém escreve direto nela.
- **Dados mínimos (LGPD):** do onboarding o banco guarda só as respostas (nome, renda, objetivo, metas,
  estilo), apagadas junto com a conta. O banco não guarda o texto das mensagens, só o registro (valor, descrição curta)
  e o id da mensagem por 7 dias, para evitar duplicados. O WAHA não baixa mídia. A pessoa apaga um registro no
  app, e "Excluir conta" apaga tudo.
- **Painel do WAHA:** https://waha.srv2176785.hstgr.cloud/dashboard. Exige usuário e senha, e a API exige
  `X-Api-Key`. O Swagger está desligado.

## 4. O que está instalado

| Peça | Onde | Detalhe |
|---|---|---|
| WAHA Core (grátis) | VPS `/docker/waha` (compose versionado em `deploy/waha/docker-compose.yml`) | Imagem `devlikeapro/waha:gows`, limite de 768 MB. Sessão `default` criada e esperando o QR. Fala com o app por dentro da rede `meudia_default`. |
| Segredos do WAHA | VPS `/docker/waha/.env` (600) | `WAHA_API_KEY` (só o hash sha512), usuário e senha do painel, `WHATSAPP_HOOK_HMAC_KEY` |
| Webhook | `apps/web/app/api/whatsapp/webhook/route.ts` + `apps/web/lib/whatsapp/` | Parser por regras, Claude opcional, RPC e resposta |
| Banco | migrations `010_treino_dieta_whatsapp.sql`, `011_whatsapp_onboarding.sql` e `012_whatsapp_amigo.sql` (aplicadas em 19/11/2026) | `profiles.whatsapp`, `registros_treino`, `registros_refeicao`, `whatsapp_contatos` (com `fatos`), `private.*`, RPCs |
| Onboarding, persona e amigo | `apps/web/lib/whatsapp/{onboarding,persona,ganchos,contato,ia}.ts`, página `app/whatsapp/page.tsx` | Máquina de estados e ganchos testados com Haiku simulado |
| Cópias dos segredos | Só no computador do assistente (`/workspace/secrets/`, 600) | `waha-api-key.txt`, `waha-dashboard.txt`, `whatsapp-hmac.txt`, `whatsapp-rpc-segredo.txt`. Nunca no git. |

Variáveis do app (`/docker/meudia/.env` no VPS):

| Variável | Valor hoje | Para quê |
|---|---|---|
| `WHATSAPP_WEBHOOK_HMAC_KEY` | definido | Confere a assinatura do WAHA |
| `WHATSAPP_RPC_SEGREDO` | definido | Segredo do RPC (o banco guarda só o hash) |
| `WAHA_URL` | `http://waha:3000` | Para responder |
| `WAHA_API_KEY` | definido | Para responder |
| `WAHA_SESSAO` | `default` | WAHA Core tem uma sessão |
| `WHATSAPP_NUMEROS_PERMITIDOS` | **vazio** | Lista de quem pode escrever (separada por vírgula) |
| `WHATSAPP_ONBOARDING_ABERTO` | `false` | `true` = qualquer número pode fazer o onboarding |
| `WHATSAPP_LIMITE_DIA` | `30` | Mensagens por número por dia |
| `ANTHROPIC_API_KEY` | definido | Claude Haiku 4.5: onboarding, persona e frases que as regras não entendem |
| `WHATSAPP_IA_MODELO` | (padrão `claude-haiku-4-5`) | Opcional |

## 5. Passo final (Estevam): só chip, QR e números

1. **Chip:** separe um número só para o bot, com WhatsApp instalado num celular.
2. **QR:** abra https://waha.srv2176785.hstgr.cloud/dashboard (o assistente passa o usuário e a senha por um
   canal seguro), abra a sessão `default` → "QR". No celular do chip: WhatsApp → Aparelhos conectados →
   Conectar → ler o QR. (Ou peça ao assistente, que busca o QR pela API e manda a imagem.)
3. **Números:** mande ao assistente os números que podem conversar com o bot (o seu e os de teste). Ele põe
   na lista e recria o container. Do seu WhatsApp pessoal, mande "oi" ao bot: se o seu número já está em
   Configurações → Seu WhatsApp, ele já te reconhece; senão, faz as 5 perguntas e manda o link.

Abrir para qualquer pessoa (sem lista) é só `WHATSAPP_ONBOARDING_ABERTO=true`. Só faça isso depois de testar e
sabendo do risco de banimento do chip.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| O bot não responde nada | O número não está em `WHATSAPP_NUMEROS_PERMITIDOS`, a sessão caiu (veja o status no painel) ou o número passou do limite do dia |
| "Esse link expirou ou já foi usado" | Mande "oi" ao bot: na etapa `link`, qualquer mensagem gera um link novo |
| "Esse WhatsApp já está ligado a outra conta" | O número está em Configurações → Seu WhatsApp de outra conta. Tire de lá primeiro |
| Responde "Não consegui anotar agora" | O Supabase está fora do ar ou o segredo do RPC está errado (veja `docker logs meudia-meudia-1 \| grep whatsapp`) |
| Conta nova do WhatsApp chega como `@lid` | O app procura o número real nos campos alternativos do WAHA. Se não achar, ignora |
| Número antigo, sem o 9 | Tanto a lista quanto o banco aceitam com e sem o 9 |

## 7. Próximos passos (v2)

### 7.1 Lembretes proativos (desenhado, DESLIGADO)

Nenhum código envia mensagem sem a pessoa ter escrito antes. Quando for ligar:

- **Opt-in explícito** pelo chat ("quero lembretes") → coluna `lembretes_whatsapp boolean default false` em
  `whatsapp_contatos`, via migration aditiva.
- **Agendador:** o cron do app (`/api/cron/lembretes`, já protegido por `CRON_SECRET`) roda 1×/dia às 9h (SP).
  Ele busca contas que vencem hoje ou amanhã das pessoas com opt-in e manda **no máximo 1 mensagem por dia**,
  só para quem conversou com o bot nas últimas 24h (janela parecida com a da API oficial, que reduz o risco de ban).
- Interruptor `WHATSAPP_LEMBRETES=false` por padrão. "parar" desliga na hora.

### 7.2 Outros

- "desfazer" / "apaga o último" pelo chat (recibo com desfazer, como no Meu Assessor).
- Resumo do mês sob pedido ("como está meu mês?"), usando o mesmo cartão do Relatório.
- API oficial (Cloud API) se o volume crescer: sem risco de banimento, mas com custo por conversa.
