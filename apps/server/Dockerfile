FROM node:20-slim

WORKDIR /app

RUN corepack enable

# Toolchain for compiling argon2 from source; its prebuilt binary segfaults.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/server/package.json apps/server/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/client/package.json apps/client/package.json

RUN npm_config_build_from_source=true pnpm install --frozen-lockfile

COPY packages packages
COPY apps/server apps/server

WORKDIR /app/apps/server

EXPOSE 4000

CMD ["pnpm", "dev"]
