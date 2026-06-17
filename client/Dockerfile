FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/

# Install dependencies (will fetch pnpm via corepack and install)
RUN pnpm install --filter client...

COPY shared ./shared
COPY client ./client

WORKDIR /app/client
RUN pnpm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/client/dist /usr/share/nginx/html

# SPA routing config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
