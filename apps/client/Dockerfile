FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile --filter client...

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/client apps/client

WORKDIR /app/apps/client

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]