import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Один билд обслуживает оба домена (extree.tech и bot.extree.tech/dashboard)
// из одного и того же Express-процесса (dashboard/server.js) — поэтому
// ассеты собираются в единый dist/assets/, на который Caddy проксирует
// /assets/* одинаково на обоих доменах (см. web/Caddyfile).
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
