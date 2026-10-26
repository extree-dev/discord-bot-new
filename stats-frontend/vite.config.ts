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
    server: {
        proxy: {
            // Проксируем все запросы к API на Java-бэкенд (порт 8081)
            '/auth': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                cookieDomainRewrite: 'localhost', // <-- ДОБАВЛЕНО: чтобы куки работали на localhost
            },
            '/api': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                cookieDomainRewrite: 'localhost', // <-- ДОБАВЛЕНО: проксируем /api/account/me
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
