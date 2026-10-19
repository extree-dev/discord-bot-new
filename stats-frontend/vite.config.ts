import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Отдельный от основного frontend/ Vite-проект: Extree Stats — отдельный
// продукт (заявка в Riot Developer Portal), со своим доменом
// (stats.extree.tech) и пока без общего бэкенда с dashboard/server.js —
// общий билд с frontend/ был бы преждевременной связью двух независимых
// продуктов. Собранный бандл копируется в web/stats-site/ отдельным
// Docker-сервисом (stats-frontend-builder, см. docker-compose.yml) — Caddy
// раздаёт его оттуда как чистую статику, без Node-процесса в рантайме.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
