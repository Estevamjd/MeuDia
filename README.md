# MeuDia

Assistente pessoal de produtividade e saúde criado para centralizar rotina, hábitos, treinos, finanças, agenda e lembretes em uma experiência web e mobile.

O projeto usa um monorepo com aplicação web em Next.js, aplicativo mobile em Expo/React Native e pacotes compartilhados para API, banco de dados, regras de IA e utilitários de domínio.

## Principais recursos

- Autenticação e sincronização de dados com Supabase.
- Aplicação web instalável como PWA.
- Aplicativo mobile com Expo Router.
- Módulos para treinos, hábitos, dieta, medicamentos, agenda, finanças e notificações.
- Motor de regras para gerar alertas, saudações, dicas e resumos diários.
- Análises de consistência, descanso sugerido, carga de treino e finanças mensais.
- Estado local e consultas assíncronas com Zustand e TanStack Query.
- Formulários tipados com React Hook Form e Zod.
- Observabilidade preparada com Sentry.
- Testes unitários com Vitest e testes end-to-end com Playwright no app web.

## Arquitetura

```text
apps/
├── web/       # Next.js App Router, PWA, dashboards e rotas web
└── mobile/    # Expo/React Native com navegação por Expo Router

packages/
├── ai/        # Regras, classificação de intenções, análises e geradores
├── api/       # Camada compartilhada de acesso e contratos de API
├── database/  # Configurações e utilitários relacionados ao banco
└── shared/    # Tipos, constantes e funções reutilizáveis
```

## Stack

| Área | Tecnologias |
| --- | --- |
| Monorepo | pnpm, Turborepo, TypeScript |
| Web | Next.js 14, React 18, Tailwind CSS |
| Mobile | Expo 52, React Native 0.76, NativeWind |
| Dados | Supabase, PostgreSQL |
| Estado e dados | Zustand, TanStack Query |
| Formulários | React Hook Form, Zod |
| Gráficos | Recharts, Victory Native |
| Qualidade | Vitest, Playwright, ESLint, Prettier |
| Observabilidade | Sentry |

## Rodando localmente

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Rodar tudo em desenvolvimento
pnpm dev
```

### Web

```bash
pnpm --filter @meudia/web dev
```

### Mobile

```bash
pnpm --filter @meudia/mobile dev
```

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de servidor para operações seguras |
| `NEXT_PUBLIC_APP_URL` | URL base da aplicação web |
| `NEXT_PUBLIC_APP_NAME` | Nome público do aplicativo |
| `SENTRY_DSN` | DSN de erros no servidor |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de erros no navegador |
| `APP_MODE` | Modo do app (`padrao` ou `financas`); ver abaixo |
| `VAPID_PUBLIC_KEY` | Chave pública de web-push, lida no layout raiz |

### APP_MODE

- Valores aceitos: `padrao` (todos os módulos) e `financas` (só Finanças, Assinaturas e Configurações). Qualquer outro valor, ou ausente, vira `padrao`.
- É env de servidor, **sem** `NEXT_PUBLIC_`; chega ao cliente pelo layout raiz.
- O layout raiz é renderizado por request (`noStore()`), então o modo vem do env do servidor em runtime. `e2e/modo-runtime.spec.ts` builda sem `APP_MODE`, sobe com `APP_MODE=financas` e falha se o modo congelar no build. Na Vercel, mudar uma env só vale a partir de um novo deploy.

## Qualidade

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm --filter @meudia/web test:e2e
scripts/verify.sh   # o que o CI roda: type-check, lint, unitários, E2E mock (iPhone 13 WebKit) e testes SQL (verify.sh db)
```

## Status

Projeto em desenvolvimento ativo, com base preparada para evoluir como assistente pessoal multiplataforma.

## Ordem de deploy

Aplicar a migração `packages/database/migrations/006_carteiras.sql` antes do deploy do código de carteiras e saldo. Confirmar tabelas, colunas, grants e RPCs da 006 no banco de destino antes de publicar. A aplicação da migração e o deploy exigem OK do dono.
