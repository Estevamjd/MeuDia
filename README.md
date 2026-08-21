# MeuDia

Assistente pessoal de produtividade e saude criado para centralizar rotina, habitos, treinos, financas, agenda e lembretes em uma experiencia web e mobile.

O projeto usa um monorepo com aplicacao web em Next.js, aplicativo mobile em Expo/React Native e pacotes compartilhados para API, banco de dados, regras de IA e utilitarios de dominio.

## Principais recursos

- Autenticacao e sincronizacao de dados com Supabase.
- Aplicacao web instalavel como PWA.
- Aplicativo mobile com Expo Router.
- Modulos para treinos, habitos, dieta, medicamentos, agenda, financas e notificacoes.
- Motor de regras para gerar alertas, saudacoes, dicas e resumos diarios.
- Analises de consistencia, descanso sugerido, carga de treino e financas mensais.
- Estado local e consultas assíncronas com Zustand e TanStack Query.
- Formularios tipados com React Hook Form e Zod.
- Observabilidade preparada com Sentry.
- Testes unitarios com Vitest e testes end-to-end com Playwright no app web.

## Arquitetura

```text
apps/
├── web/       # Next.js App Router, PWA, dashboards e rotas web
└── mobile/    # Expo/React Native com navegacao por Expo Router

packages/
├── ai/        # Regras, classificacao de intencoes, analises e geradores
├── api/       # Camada compartilhada de acesso e contratos de API
├── database/  # Configuracoes e utilitarios relacionados ao banco
└── shared/    # Tipos, constantes e funcoes reutilizaveis
```

## Stack

| Area | Tecnologias |
| --- | --- |
| Monorepo | pnpm, Turborepo, TypeScript |
| Web | Next.js 14, React 18, Tailwind CSS |
| Mobile | Expo 52, React Native 0.76, NativeWind |
| Dados | Supabase, PostgreSQL |
| Estado e dados | Zustand, TanStack Query |
| Formularios | React Hook Form, Zod |
| Graficos | Recharts, Victory Native |
| Qualidade | Vitest, Playwright, ESLint, Prettier |
| Observabilidade | Sentry |

## Rodando localmente

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variaveis de ambiente
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

## Variaveis de ambiente

| Variavel | Descricao |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL publica do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave publica anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de servidor para operacoes seguras |
| `NEXT_PUBLIC_APP_URL` | URL base da aplicacao web |
| `NEXT_PUBLIC_APP_NAME` | Nome publico do aplicativo |
| `SENTRY_DSN` | DSN de erros no servidor |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN de erros no navegador |

## Qualidade

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm --filter @meudia/web test:e2e
```

## Status

Projeto em desenvolvimento ativo, com base preparada para evoluir como assistente pessoal multiplataforma.
