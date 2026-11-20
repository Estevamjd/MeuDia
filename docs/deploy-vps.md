# MeuDia na VPS (Traefik existente)

Hospeda o app web (`@meudia/web`) em `https://meudia.srv2176785.hstgr.cloud`, atrás do Traefik que já atende o n8n. Não sobe um segundo proxy e não altera os containers do n8n.

## Onde roda

- Compose: `/docker/meudia/docker-compose.yml` na VPS (`srv2176785.hstgr.cloud`)
- Código usado no build: `/docker/meudia/src`
- Variáveis: `/docker/meudia/.env` (permissão `600`, fora do Git)
- Limite de memória do container: 1 GiB
- Banco: projeto Supabase `MeuDia` (`klbnvejdmscgbrikcwrl`). O deploy na Vercel permanece no ar.

Padrão de labels do Traefik (igual ao n8n):

- `traefik.enable=true`
- `Host(\`meudia.srv2176785.hstgr.cloud\`)`
- entrypoint `websecure` e `tls.certresolver=letsencrypt`

## Atualizar

No repositório, a partir da pasta de deploy na VPS:

```bash
# sincronizar o código e o Dockerfile, depois:
cd /docker/meudia
docker compose build
docker compose up -d
```

`APP_MODE` é lido em runtime. `NEXT_PUBLIC_*` entra no bundle no build: mudar URL ou chaves públicas do Supabase exige rebuild.

Para habilitar o Sentry, `NEXT_PUBLIC_SENTRY_DSN` precisa ser passado como build-arg no build da imagem (o `docker-compose.yml` já o passa em `build.args`). Alterar esse DSN exige rebuild. Definir apenas `SENTRY_DSN` em runtime não liga o Sentry: as configurações usam `NEXT_PUBLIC_SENTRY_DSN`.

## Auth

O login com e-mail e senha fala direto com o Supabase. Para magic link / confirmação de e-mail no host da VPS, acrescente `https://meudia.srv2176785.hstgr.cloud/**` em Additional Redirect URLs no painel do Supabase, sem remover a URL da Vercel.

### Esqueceu a senha?

Fluxo: link "Esqueceu a senha?" no `/login` → `/esqueci-senha` (pede o link; mensagem sempre genérica, não revela se o
e-mail tem conta) → e-mail do Supabase → `/nova-senha` (define a senha nova e já entra). O pedido usa o fluxo implícito
(`lib/supabase/recuperacao-client.ts`): os tokens voltam no `#` do link e funcionam em qualquer navegador/aparelho, não só
no que fez o pedido (o PKCE exigiria o mesmo navegador). `/nova-senha` também aceita `?code=` e `?token_hash=`; um link que
cair na raiz ou no `/login` com `type=recovery` segue sozinho para `/nova-senha`.

Configuração que só o painel do Supabase muda (o conector MCP não tem ferramenta para auth config):

- Authentication → URL Configuration:
  - Site URL: `https://meudia.srv2176785.hstgr.cloud`. Hoje ainda é `https://meudia.vercel.app`; sem a troca, o link
    do e-mail cai no app antigo da Vercel.
  - Redirect URLs: `https://meudia.srv2176785.hstgr.cloud/**` (e manter `https://meudia.vercel.app/**`).
- Authentication → Emails → Reset Password: o template padrão está em inglês. Sugestão em PT-BR:
  - Assunto: `Crie uma nova senha no MeuDia`
  - Corpo: `<h2>Esqueceu a senha?</h2><p>Recebemos um pedido para criar uma nova senha na sua conta do MeuDia.</p><p><a href="{{ .ConfirmationURL }}">Criar nova senha</a></p><p>O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`
- Limite de envio: sem SMTP próprio, o Supabase envia no máximo 2 e-mails de auth por hora para o projeto inteiro
  (e 1 pedido por e-mail a cada 60 s). Acima disso a tela mostra "Muitos pedidos em pouco tempo". Para mais volume,
  configurar SMTP próprio (Authentication → Emails → SMTP Settings).

## Imagem standalone (P1.6)

O build usa Node 22 Bookworm slim e pnpm 10.33.0 via Corepack; instala com lockfile congelado e filtro
`@meudia/web...` (o manifesto mobile mantém o glob do workspace válido). O runner parte de outra imagem
Node limpa, roda como UID 1001 e contém somente `.next/standalone`, `.next/static` e `public` nos caminhos
do monorepo. Inicia com `node apps/web/server.js`; não precisa de pnpm, fontes ou dependências de desenvolvimento.
`APP_MODE` continua exclusivamente em runtime, nunca como ARG/ENV do estágio de build.

`output: 'standalone'` fica habilitado também na Vercel: é uma saída adicional do Next, compatível com
`vercel.json` e seu `outputDirectory: apps/web/.next`; não há motivo para criar uma variável de seleção.
O tracing tem a raiz do monorepo. Fontes locais importadas por `next/font`, instrumentação e configurações
Sentry importadas entram pelo build/trace; não há leitura de arquivo de aplicação em runtime que exija copiar
as fontes. O sharp instalado no build deve aparecer no trace com seu binário e libvips em
`node_modules/.pnpm/@img+sharp-*`; o Dockerfile valida o carregamento nativo no próprio build, resolvendo sharp a partir do Next
(o pacote pode não resolver diretamente a partir de `apps/web` no standalone pnpm).

Referência: [Next 14: output e tracing](https://nextjs.org/docs/14/app/api-reference/next-config-js/output).

## Limites no Traefik 3.7

| Router | Caminhos (sempre no host MeuDia) | Média / período | Burst | Prioridade |
| --- | --- | --- | --- | --- |
| `meudia-ganchos` | `/api/whatsapp/…`, `/api/cron/…` | 600 / 1m | 200 | 200 |
| `meudia-api` | demais `/api/…` | 60 / 1m | 30 | 100 |
| `meudia-login` | `/login`, `/registro`, `/esqueci-senha` | 30 / 1m | 20 | 100 |
| `meudia` | demais caminhos | sem limitador | — | 1 |

Cada router aponta explicitamente para o serviço `meudia`, entrypoint `websecure` e resolver `letsencrypt`.
Regras usam `Host(...) && (...)`, `Path` e `PathPrefix` na sintaxe v3. Parâmetros ficam nos labels
`traefik.http.middlewares.meudia-<grupo>-limit.ratelimit.average`, `.period` e `.burst`.
Para ajustar, edite esses labels no compose e recrie só o serviço `meudia`.

O agrupamento padrão é por IP remoto (`RemoteAddr`); não configuramos profundidade de `X-Forwarded-For`
porque Traefik é a borda. Não confiar em um header enviado pelo cliente evita contornar o limite.
Os valores toleram IPs compartilhados por CGNAT e a API tem baixo volume: dados e autenticação vão direto
ao Supabase. O limite das páginas de login inclui navegação RSC com `?_rsc=` e não limita tentativas de
senha no Supabase. Burst é a capacidade instantânea; a média repõe tokens durante o período, não é uma
janela fixa por minuto. A contagem é local ao processo Traefik e reinicia com ele.

WAHA chama `http://meudia:3000/api/whatsapp/webhook` pela rede Docker interna, sem Traefik; estes labels
não limitam essa chamada. n8n pode passar pelo host público a cada 15 minutos (WhatsApp) e uma vez por dia
(cron): o router de prioridade 200 recebe somente o limite generoso, sem acumular o limite da API.

Referências: [RateLimit v3.7](https://doc.traefik.io/traefik/v3.7/reference/routing-configuration/http/middlewares/ratelimit/)
e [regras e prioridades v3.7](https://doc.traefik.io/traefik/v3.7/reference/routing-configuration/http/routing/rules-and-priority/).

Depois do deploy autorizado, pelo host público (não pelo loopback do container), uma chamada normal
sem sessão deve retornar não-429, por exemplo 401. Para comprovar o burst sem executar ações nem usar
credenciais, faça GET em uma rota de API inexistente; 404 é esperado antes do limite:

```bash
base=https://meudia.srv2176785.hstgr.cloud
curl -sS -o /dev/null -w '%{http_code}\n' "$base/api/financas/exportar"
# Cerca de 40 chamadas rápidas concorrentes do mesmo IP: espere uma mistura de 404 e 429.
# Paralelismo evita que a reposição de 1 token/s esconda o burst durante chamadas sequenciais lentas.
seq 1 40 | xargs -P 20 -I{} curl -sS -o /dev/null -w '%{http_code}\n' "$base/api/p16-rate-limit-check" | sort | uniq -c
```

Execute em horário tranquilo: a prova compartilha o bucket de API com outros usuários do mesmo IP.
Aguarde a reposição (30 s para o bucket API vazio encher) antes de repetir. Não faça carga em webhook/cron.

## Publicação e retorno da P1.6 (somente com OK do dono)

1. Antes de substituir arquivos em `/docker/meudia`, guarde uma cópia do compose atual, do diretório
   `src` usado pela imagem anterior e de `.env` em backup privado (permissão 600; nunca imprimir seu conteúdo).
   Preserve também a imagem antiga: `docker image tag meudia-web:latest meudia-web:before-p16`.
2. Sincronize a revisão de código aprovada inteira para `/docker/meudia/src` (sem `.env`, `.git`,
   `node_modules` ou `.next` locais). Nesta tarefa os arquivos de build alterados são `Dockerfile` e
   `apps/web/next.config.js`; mantenha `.dockerignore` junto, sem alterações. Copie
   `deploy/vps/docker-compose.yml` para `/docker/meudia/docker-compose.yml` e mantenha este documento
   em `src/docs/deploy-vps.md`. Preserve `/docker/meudia/.env`; nenhuma mudança de variável ou migration
   é necessária.
3. Em `/docker/meudia`, valide com `docker compose config --quiet`, depois
   `docker compose build meudia` e `docker compose up -d --no-deps meudia`. Não recrie Traefik/n8n/WAHA.
4. Confira healthcheck (`docker compose ps`), rode `scripts/verify.sh smoke` contra o host da VPS,
   confira login, manifest, ícone, chunk estático e os curls acima. Confira nos logs do Traefik se os
   routers/middlewares foram aceitos. Docker/Traefik e o limite 429 precisam dessa prova no VPS;
   o teste standalone local não substitui a validação do container e do proxy.
5. Para voltar: restaure compose e fontes do backup, retague
   `docker image tag meudia-web:before-p16 meudia-web:latest`, rode
   `docker compose up -d --no-deps --force-recreate meudia` (sem rebuild) e repita o smoke.
   `.env` fica preservado; só restaure o backup privado se ele tiver sido alterado separadamente.

## Evidência local P1.6

Sem Docker e sem acessar VPS/Supabase: cópia por rsync sem node_modules/.next/.env, instalação congelada,
Node 22.23.5 e pnpm 10.33.0, build com URL Supabase de loopback e chave fictícia. A primeira cópia do
workspace encontrou um erro de tipos das alterações simultâneas, fora desta tarefa, em
`financas/carteiras/page.tsx:84` (`painel.data.transferencias`). A prova isolada abaixo usa HEAD para
os demais arquivos e as alterações P1.6 por cima; o estado integrado precisa de nova verificação.

O layout foi montado em `/tmp/p16-runner` com os mesmos três COPYs do Dockerfile e iniciado com
`APP_MODE=financas PORT=3123 HOSTNAME=127.0.0.1 node apps/web/server.js`, sem APP_MODE no build.
Login 200 com modo financas no HTML; manifest 200; icon-192 e favicon-32x32 200; chunk JS 200;
`/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75` 200. Smoke local passou. Instrumentação Node e
edge estão em `.next/server`; sharp-linux-x64.node e libvips foram rastreados. O sharp nativo gerou
um PNG de 92 bytes pela resolução do Next, sem NEXT_SHARP_PATH nem cópia extra.

`du -sh`: runner 72M, cópia completa com node_modules 2.5G (proxy aproximado do antigo COPY /app,
não tamanho de imagem Docker; inclui dependências de todo o workspace). YAML e configuração dos
routers passaram; checagem de standalone/labels falhou no HEAD original e passou com a alteração.

`scripts/verify.sh static`: passou (type-check, lint e 145 arquivos / 1.712 testes).
`scripts/verify.sh db`: passou, incluindo concorrência de corrigir saldo, com PostgreSQL descartável local.
`scripts/verify.sh e2e`: 23 passaram, 1 falhou e 1 não rodou; a falha em
`novo-usuario.spec.ts:334` é a asserção de console vazio após logout (prefetch RSC de `/registro` e
`/esqueci-senha`: `TypeError: Load failed`). Artefatos preservados em
`/tmp/p16-copy/apps/web/e2e/artifacts/test-results/novo-usuario-…/`. A verificação geral não está verde.
O teste usa `next start`, que avisa sobre standalone; o runner foi verificado separadamente com `server.js`.

O controle do spec com a configuração original do Next não chegou ao build: a porta 54329 já estava
ocupada pelo mock de outro agente em `/tmp/wt-ui`. Esse processo foi preservado; a falha de RSC não foi
classificada como preexistente sem essa comparação. Docker não está instalado neste ambiente; build
real da imagem, aceitação dos labels pelo Traefik e respostas 429 permanecem para o deploy autorizado.

O smoke atualizado por outro agente (login 200 + modo em `/onboarding`) também passou contra o runner
isolado. `/api/modo` não existe nesta revisão. O runner local foi encerrado ao final.

## Ordem da Wave 2B (migration 016)

Com OK do Estevam para deploy e, separadamente, para aplicar a migration:

1. Publicar primeiro o código compatível com ausência da 016 e verificar o app.
2. Antes da aplicação, conferir se `public.perfil_saude` e `public.ia_uso_diario` já existem por criação manual;
   se existirem, comparar o schema com a 016 (`IF NOT EXISTS` não corrige um schema diferente).
3. Aplicar `packages/database/migrations/016_whatsapp_v2_saude.sql` em transação única (`psql -1`, conexão
   aprovada pelo dono). A 016 ainda não foi aplicada. Não aplicar antes do código: a limpeza saiu do registro
   e passa a depender do novo chamador diário, entre 03:00 e 05:59 BRT.
4. Verificar desfazer, conciliação e manutenção; seguir o smoke previsto neste documento após o deploy.

Antes de qualquer down, com autorização, fazer backup protegido de `public.perfil_saude` e
`public.ia_uso_diario` e validar a restauração. Exemplo no psql, em diretório de backup protegido:

```sql
\copy public.perfil_saude TO 'perfil_saude.csv' WITH (FORMAT csv, HEADER true)
\copy public.ia_uso_diario TO 'ia_uso_diario.csv' WITH (FORMAT csv, HEADER true)
```

O down apaga essas duas tabelas e o log privado de ações/manutenções, perde o perfil de saúde da conta e
reinicia a cota diária. Guardar também esses logs em backup se forem necessários para recuperação operacional.
Só então executar `016_whatsapp_v2_saude_down.sql`; ele restaura a função de registro da 012.


## Wave 3A (017)

Com autorização do dono, aplicar a 017 antes do código: todos os SELECTs novos de
transações pedem `parcela_*`. A migração é aditiva; o código anterior ignora essas colunas.

1. Conferir previamente que `public.uq_transacoes_parcela` não existe, ou que pertence
   a `public.transacoes` e tem a definição esperada. O up aborta se o nome existir sem ser índice único dessa tabela;
   `IF NOT EXISTS` não corrige a definição.
2. Aplicar `packages/database/migrations/017_parcelamento.sql` com `psql -1 -v ON_ERROR_STOP=1`
   na conexão aprovada, ou pelo Supabase MCP `apply_migration` (detalhes abaixo).
   O arquivo exige transação única: `SET LOCAL lock_timeout = '5s'`
   não vaza para a sessão. Up e down verificam esse timeout antes do DDL e emitem
   "017: execute em transação única" se ele não estiver ativo. Essa guarda só aborta a execução
   do arquivo se o runner parar no primeiro erro, como em `psql -1 -v ON_ERROR_STOP=1`;
   `psql -f` sem essas opções continua após o erro e pode aplicar DDL em autocommit.
   Se expirar esperando lock, investigar a sessão bloqueadora e
   repetir a transação inteira. O CHECK nasce `NOT VALID` e depois é validado; os locks
   dos ALTERs permanecem até o commit, portanto manter a transação curta.
3. No PostgREST self-hosted, após o commit executar `NOTIFY pgrst, 'reload schema';`
   (necessário somente no self-hosted). No Supabase hospedado, o PostgREST recarrega
   o schema automaticamente após DDL. Em ambos, confirmar a leitura de `parcela_grupo`,
   `parcela_num` e `parcela_total` antes de publicar o código. Confirmar em `pg_index`
   que o índice pertence a `public.transacoes`.
4. Publicar o código somente após essas verificações.

Rollback: reverter o código primeiro, confirmar que os leitores novos saíram e só então
executar `017_parcelamento_down.sql` com `psql -1 -v ON_ERROR_STOP=1`. Recarregar o schema
novamente após o commit (NOTIFY somente no self-hosted; automático no hospedado).
O down preserva linhas, valores e datas, mas perde o agrupamento.

O `verify.sh db` inclui o arquivo dentro de `BEGIN`/`ROLLBACK`. O Supabase MCP
`apply_migration` é um caminho aceito: envia o arquivo inteiro como uma única query,
executada em uma transação implícita. Nesse formato foi medido que o `lock_timeout`
de 5 s é respeitado com rollback total, a reaplicação é idempotente e um índice
`uq_transacoes_parcela` de outra tabela aborta sem criar colunas. Não inserir
`BEGIN`/`COMMIT` no arquivo para não encerrar uma transação do executor.
