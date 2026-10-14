import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Один билд обслуживает оба домена (extree.tech и bot.extree.tech/dashboard)
// из одного и того же Express-процесса (dashboard/server.js) — поэтому
// ассеты собираются в единый dist/assets/, на который Caddy проксирует
// /assets/* одинаково на обоих доменах (см. web/Caddyfile).
export default defineConfig({
    plugins: [react()],
    // Только для `npm run dev`: сам dashboard/server.js (который в проде
    // отдаёт /api/*) требует Discord-токен + Postgres, поднимать его
    // локально ради правки одной страницы избыточно — вместо этого
    // проксируем /api на прод, чтобы видеть реальный контент.
    server: {
        proxy: {
            '/api': {
                target: 'https://extree.tech',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
