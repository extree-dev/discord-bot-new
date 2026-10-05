# syntax=docker/dockerfile:1

# Личный кабинет/редактор визитки (dashboard/) — React-SPA, собирается
# отдельным стейджем: bundler (vite, typescript) и его node_modules не
# должны попадать в финальный образ бота, там нужен только статический
# frontend/dist.
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Отдельный слой под зависимости — пересобирается только когда меняются
# package.json/package-lock.json, а не при каждой правке исходников.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Бот пишет только в PostgreSQL, но security/backup.js всё ещё сохраняет
# бэкапы структуры сервера на диск (data/backups) — оставляем для этого
# каталог с правильными правами и запускаем не от root.
RUN addgroup -S bot \
    && adduser -S bot -G bot \
    && mkdir -p /app/data \
    && chown -R bot:bot /app/data
USER bot

CMD ["node", "index.js"]
