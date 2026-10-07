FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "run", "start:web"]
