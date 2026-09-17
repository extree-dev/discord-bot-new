# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Отдельный слой под зависимости — пересобирается только когда меняются
# package.json/package-lock.json, а не при каждой правке исходников.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Бот пишет только в PostgreSQL, но security/backup.js всё ещё сохраняет
# бэкапы структуры сервера на диск (data/backups) — оставляем для этого
# каталог с правильными правами и запускаем не от root.
RUN addgroup -S bot \
    && adduser -S bot -G bot \
    && mkdir -p /app/data \
    && chown -R bot:bot /app/data
USER bot

CMD ["node", "index.js"]
