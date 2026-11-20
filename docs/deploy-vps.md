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
