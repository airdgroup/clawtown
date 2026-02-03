FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Production dependencies only (Playwright stays dev-only).
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY public ./public

# Fly will route external 443/80 to this internal port (see fly.toml).
EXPOSE 8080

CMD ["node", "server/index.js"]

