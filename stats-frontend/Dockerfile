# syntax=docker/dockerfile:1

# Собирает статический бандл Extree Stats (Vite + React) — это не
# рантайм-сервис: контейнер собирает dist/ и выходит, реальный вывод
# копируется наружу в web/stats-site/ через bind-mount /output (см.
# docker-compose.yml, сервис stats-frontend-builder, запускается
# deploy.yml через "docker compose run --rm"). Caddy раздаёт
# web/stats-site/ напрямую как статику (web/Caddyfile) — отдельного
# Node-процесса для этого продукта в проде нет.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["sh", "-c", "rm -rf /output/* && cp -r dist/. /output/"]
