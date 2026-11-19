# Assistente do MeuDia no WhatsApp

Estado em 19/11/2026: **infraestrutura pronta, esperando o número.** Falta só ler o QR com o chip do bot
e pôr os números autorizados na lista.

## 1. Como funciona

```
Você no WhatsApp ──► chip do bot (WAHA no VPS) ──webhook assinado──► MeuDia /api/whatsapp/webhook
                                                                      │ 1. confere a assinatura HMAC
                                                                      │ 2. só número da lista de permitidos
                                                                      │ 3. entende a mensagem (regras → Claude Haiku, se houver chave)
                                                                      │ 4. grava pelo RPC whatsapp_registrar (Supabase)
                     ◄──────────────── resposta curta ─────────────── │ 5. responde "✅ Anotado…"
```

Exemplos que já funcionam (sem IA, só com regras):

| Mensagem | Vira |
|---|---|
| `gastei 45,90 no mercado` | Gasto R$ 45,90 · Mercado, no último banco usado |
| `uber 23` / `paguei 120 de luz` | Gasto · Transporte / Luz |
| `recebi 500 do freela` | Entrada · Entrada extra |
| `treinei peito 40min` / `corri 5km 30 min` | Treino (aba Treino) |
| `almocei arroz, feijão, frango` / `comi uma maçã` | Refeição (aba Dieta). O tipo vem do verbo ou da hora |
| `... ontem` | Registra no dia anterior |
| `ajuda` / `oi` | Mostra exemplos |

Tudo o que chega pelo WhatsApp aparece no app com o selo **WhatsApp** (`origem = 'whatsapp'`).

## 2. Por que webhook direto (e não n8n)

| | Webhook no MeuDia (escolhido) | n8n |
|---|---|---|
| Saltos | WAHA → app → banco | WAHA → n8n → app/banco |
| Código | Versionado no git, com testes (parser, rota, banco) | Fluxo visual que muda sem revisão |
| Segredos | Ficam no `.env` do app | Mais um lugar com credenciais |
| Custo/memória | Zero extra | O n8n já roda, mas cada fluxo pesa e falha em silêncio |
| Quando usar n8n | Automações de marketing, CRM ou integrações sem código | — |

O livro 18 da Mestres Play recomenda um webhook único, filtrar só texto de pessoa, bloquear loops e ter
uma memória por contato. Seguimos isso no código: ignoramos grupos, status, canais, mensagens próprias e
mídia, e cada mensagem tem deduplicação no banco.

## 3. Segurança e riscos (ler antes de ligar)

- **Conexão não oficial.** O WAHA usa o WhatsApp Web (engine GOWS). Os termos do WhatsApp proíbem uso
  automatizado/não pessoal e **o número pode ser banido** (livro 19 da Mestres Play). Por isso:
  - use um **chip dedicado** ao bot, **nunca** o seu número pessoal;
  - o bot **só responde** a quem escreveu e a quem está na lista. **Nada de envio em massa.**
    Os lembretes proativos estão **desligados**: nenhum código envia mensagem sem alguém ter escrito antes;
  - grupos são ignorados.
- **Lista de permitidos** (`WHATSAPP_NUMEROS_PERMITIDOS`): **vazia = ninguém escreve.** Números fora da lista
  são ignorados em silêncio, sem resposta.
- **Webhook assinado:** o WAHA assina cada evento com HMAC-SHA512. Sem assinatura válida a rota responde 401.
  Sem a chave configurada, a rota fica desligada (503).
- **Banco sem service role:** o app grava pela função `public.whatsapp_registrar` (SECURITY DEFINER). Ela exige
  um segredo, do qual o banco guarda só o hash sha256 em `private.integracoes`. Ela também exige que o número
  esteja ligado a uma conta em `profiles.whatsapp`, e descarta mensagens repetidas por 7 dias.
- **Dados mínimos (LGPD):** o banco não guarda o texto das mensagens, só o registro (valor, descrição curta)
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
| Banco | migration `010_treino_dieta_whatsapp.sql` (aplicada em 19/11/2026) | `profiles.whatsapp`, `registros_treino`, `registros_refeicao`, `private.*`, RPC |
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
| `ANTHROPIC_API_KEY` | **vazio** | Opcional: Claude Haiku 4.5 para frases que as regras não entendem |
| `WHATSAPP_IA_MODELO` | (padrão `claude-haiku-4-5`) | Opcional |

## 5. Passo final (Estevam)

1. **Chip:** separe um número só para o bot, com WhatsApp instalado num celular.
2. **QR:** abra https://waha.srv2176785.hstgr.cloud/dashboard. O assistente passa o usuário, a senha e a
   API key por um canal seguro. Abra a sessão `default` → "QR", e no celular do chip vá em
   WhatsApp → Aparelhos conectados → Conectar → ler o QR.
   (Alternativa: peça ao assistente, que busca o QR pela API e manda a imagem.)
3. **Seu número no app:** MeuDia → Configurações → **Seu WhatsApp** → `(DDD) número`. Isso liga o número à sua
   conta.
4. **Lista de permitidos:** peça ao assistente, ou no VPS:
   ```bash
   cd /docker/meudia
   sed -i 's/^WHATSAPP_NUMEROS_PERMITIDOS=.*/WHATSAPP_NUMEROS_PERMITIDOS=5511999999999/' .env   # vários: separados por vírgula
   docker compose up -d   # recria o container com a env nova (não precisa rebuild)
   ```
5. **Teste:** do seu WhatsApp pessoal, mande `ajuda` para o número do bot, e depois `gastei 10 no teste`.
   O registro aparece na Início com o selo WhatsApp. Exclua-o depois.
6. **(Opcional) Claude:** coloque `ANTHROPIC_API_KEY=...` no mesmo `.env` e rode `docker compose up -d`.
   Custo: o Haiku só é chamado quando as regras não entendem, com cerca de 300 tokens por chamada.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| O bot não responde nada | O número não está em `WHATSAPP_NUMEROS_PERMITIDOS`, ou a sessão caiu (veja o status no painel) |
| Responde "Este número ainda não está ligado a uma conta" | Falta preencher Configurações → Seu WhatsApp |
| Responde "Não consegui anotar agora" | O Supabase está fora do ar ou o segredo do RPC está errado (veja `docker logs meudia-meudia-1 \| grep whatsapp`) |
| Conta nova do WhatsApp chega como `@lid` | O app procura o número real nos campos alternativos do WAHA. Se não achar, ignora |
| Número antigo, sem o 9 | Tanto a lista quanto o banco aceitam com e sem o 9 |

## 7. Próximos passos (v2)

- "desfazer" / "apaga o último" pelo chat (recibo com desfazer, como no Meu Assessor).
- Resumo do mês sob pedido ("como está meu mês?"), usando o mesmo cartão do Relatório.
- Lembretes proativos, só com opt-in explícito e no máximo 1 por dia.
- API oficial (Cloud API) se o volume crescer: sem risco de banimento, mas com custo por conversa.
