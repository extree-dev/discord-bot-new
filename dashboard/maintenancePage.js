// Статичная HTML-страница техперерыва — отдаётся как есть, без React/
// сборки фронтенда, поэтому не зависит ни от /api/*, ни от frontend/dist
// (в режиме техперерыва всё остальное всё равно не отвечает — см.
// server.js). Оформление в духе статус-страниц крупных SaaS (Linear/
// Vercel/Stripe): тёмный фон с едва заметной сеткой и виньеткой, тонкая
// карточка-бейдж "Scheduled maintenance" с пульсирующей точкой, крупный
// заголовок Unbounded, спокойная карточка метаданных (статус/ETA) —
// без кричащих градиентов и декоративных иконок прошлой версии. Текст —
// на английском (по прямому запросу администратора). Та же вёрстка —
// буквально идентичный HTML/CSS — дублируется в web/bot-site/maintenance.html:
// это статика, которую раздаёт Caddy напрямую для bot.extree.tech (минуя
// этот процесс, см. web/Caddyfile), так что единого файла-источника
// для обеих поверхностей нет — при правке дизайна менять оба файла.
module.exports = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Scheduled Maintenance — extree.tech</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@600;700&display=swap');

            :root {
                --bg: #07090d;
                --surface: rgba(255, 255, 255, 0.03);
                --border: rgba(255, 255, 255, 0.08);
                --border-strong: rgba(255, 255, 255, 0.14);
                --text: #f3f4f6;
                --text-dim: rgba(243, 244, 246, 0.64);
                --text-faint: rgba(243, 244, 246, 0.4);
                --accent: #5b93ff;
                --accent-dim: rgba(91, 147, 255, 0.5);
                --amber: #ffb648;
            }

            * {
                box-sizing: border-box;
            }

            html,
            body {
                margin: 0;
                height: 100%;
            }

            body {
                position: relative;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                overflow: hidden;
                background: var(--bg);
                background-image:
                    radial-gradient(60% 50% at 82% 6%, rgba(91, 147, 255, 0.16), transparent 60%),
                    radial-gradient(40% 35% at 8% 96%, rgba(91, 147, 255, 0.09), transparent 60%),
                    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
                background-size:
                    auto,
                    auto,
                    40px 40px,
                    40px 40px;
                background-position:
                    0 0,
                    0 0,
                    -1px -1px,
                    -1px -1px;
                color: var(--text);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                -webkit-font-smoothing: antialiased;
                text-align: center;
            }

            .vignette {
                position: absolute;
                inset: 0;
                background: radial-gradient(60% 55% at 50% 38%, transparent 0%, var(--bg) 92%);
                pointer-events: none;
            }

            .wrap {
                position: relative;
                z-index: 1;
                width: 100%;
                max-width: 440px;
            }

            .mark {
                display: inline-flex;
                width: 40px;
                height: 40px;
                align-items: center;
                justify-content: center;
                margin-bottom: 28px;
                border-radius: 11px;
                background: linear-gradient(160deg, #7cabff, #3b72e0);
                box-shadow:
                    0 0 0 1px rgba(255, 255, 255, 0.12) inset,
                    0 10px 24px -8px rgba(59, 114, 224, 0.55);
            }

            .mark svg {
                width: 18px;
                height: 18px;
            }

            .pill {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px 6px 10px;
                margin-bottom: 24px;
                border-radius: 999px;
                border: 1px solid var(--border-strong);
                background: var(--surface);
                font-size: 12.5px;
                font-weight: 500;
                letter-spacing: 0.02em;
                color: var(--text-dim);
            }

            .dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: var(--amber);
                animation: pulse 2s ease-out infinite;
            }

            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 182, 72, 0.55);
                }
                70% {
                    box-shadow: 0 0 0 7px rgba(255, 182, 72, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 182, 72, 0);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .dot {
                    animation: none;
                }
            }

            h1 {
                margin: 0 0 14px;
                font-family: 'Unbounded', sans-serif;
                font-size: clamp(26px, 4.6vw, 34px);
                font-weight: 600;
                letter-spacing: -0.015em;
                line-height: 1.25;
            }

            p.lead {
                margin: 0 auto;
                max-width: 380px;
                color: var(--text-dim);
                font-size: 15.5px;
                line-height: 1.65;
            }

            .card {
                margin: 32px auto 0;
                padding: 18px 20px;
                max-width: 360px;
                border: 1px solid var(--border);
                border-radius: 14px;
                background: var(--surface);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 20px;
                text-align: left;
            }

            .meta {
                flex: 1;
            }

            .meta-label {
                margin-bottom: 4px;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--text-faint);
            }

            .meta-value {
                font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
                font-size: 13.5px;
                color: var(--text);
            }

            .meta-value.accent {
                color: var(--accent);
            }

            .divider {
                width: 1px;
                align-self: stretch;
                background: var(--border);
            }

            a.contact {
                display: inline-block;
                margin-top: 28px;
                border-bottom: 1px solid var(--border-strong);
                padding-bottom: 1px;
                color: var(--text-dim);
                font-size: 13.5px;
                text-decoration: none;
                transition:
                    color 0.15s ease,
                    border-color 0.15s ease;
            }

            a.contact:hover {
                border-color: var(--accent-dim);
                color: var(--text);
            }

            .brand {
                margin-top: 40px;
                color: var(--text-faint);
                font-size: 12.5px;
                letter-spacing: 0.03em;
            }

            @media (max-width: 420px) {
                .card {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 14px;
                }
                .divider {
                    display: none;
                }
            }
        </style>
    </head>
    <body>
        <div class="vignette"></div>
        <div class="wrap">
            <span class="mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
                </svg>
            </span>

            <div class="pill"><span class="dot" aria-hidden="true"></span>Scheduled maintenance</div>

            <h1>We're making some improvements</h1>
            <p class="lead">
                Extree is briefly offline while we roll out updates. This usually takes less than an hour — thanks
                for your patience.
            </p>

            <div class="card">
                <div class="meta">
                    <div class="meta-label">Status</div>
                    <div class="meta-value accent">503 · Unavailable</div>
                </div>
                <div class="divider" aria-hidden="true"></div>
                <div class="meta">
                    <div class="meta-label">Back online</div>
                    <div class="meta-value">~ 1 hour</div>
                </div>
            </div>

            <a class="contact" href="mailto:support@extree.tech">Something urgent? Contact support@extree.tech</a>

            <div class="brand">extree.tech</div>
        </div>
    </body>
</html>
`;
