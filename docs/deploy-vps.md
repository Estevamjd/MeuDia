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

## Auth

O login com e-mail e senha fala direto com o Supabase. Para magic link / confirmação de e-mail no host da VPS, acrescente `https://meudia.srv2176785.hstgr.cloud/**` em Additional Redirect URLs no painel do Supabase, sem remover a URL da Vercel.
