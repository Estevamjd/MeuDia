# syntax=docker/dockerfile:1
# MeuDia web (Next.js 14 monorepo) for the existing VPS Traefik.
# APP_MODE is intentionally omitted at build time and set at runtime.

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/database/package.json packages/database/package.json
# Keep the workspace glob valid without installing the Expo app.
COPY apps/mobile/package.json apps/mobile/package.json
# pnpm 10 ignores dependency build scripts unless allowlisted (package.json untouched on purpose).
RUN printf 'onlyBuiltDependencies[]=sharp\n' >> .npmrc  && pnpm install --frozen-lockfile --filter @meudia/web...

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME=MeuDia
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN pnpm turbo run build --filter=@meudia/web

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 --create-home nextjs
COPY --from=build --chown=nextjs:nextjs /app /app
USER nextjs
EXPOSE 3000
CMD ["pnpm", "--filter", "@meudia/web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
