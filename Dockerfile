FROM node:22-alpine AS builder

WORKDIR /app
# Enable corepack for pnpm
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install dependencies (will fetch pnpm via corepack and install)
RUN pnpm install --filter server...

COPY shared ./shared
COPY server ./server

WORKDIR /app/server
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/server/package.json ./server/

# Install only production dependencies
RUN pnpm install --filter server... --prod

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server

# Add non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
