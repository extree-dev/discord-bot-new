// Статичная HTML-страница техперерыва — отдаётся как есть, без React/
// сборки фронтенда, поэтому не зависит ни от /api/*, ни от frontend/dist
// (в режиме техперерыва всё остальное всё равно не отвечает — см.
// server.js). Визуальный язык — тот же, что у визитки (frontend/src/pages
// /visitka/index.module.scss): тёмно-синий градиент hero, шрифты
// Unbounded/Inter/Benne, акцентный синий --blue: #1768ef. Оформление в
// духе классической страницы "404" (огромный код по центру) — но число
// и текст говорят о временном техперерыве, а не "страница не найдена".
module.exports = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Технический перерыв — extree.tech</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Unbounded:wght@700;800&display=swap');

* { box-sizing: border-box; }

html, body {
    margin: 0;
    height: 100%;
}

body {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    background:
        radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.06), transparent 45%),
        linear-gradient(135deg, #0c1a3d 0%, #123a8f 50%, #1768ef 100%);
    color: #f8f8f9;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
}

.card {
    max-width: 560px;
}

.mark {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    margin-bottom: 36px;
    border-radius: 13px;
    background: linear-gradient(135deg, #6a7dff, #1768ef);
    box-shadow: 0 8px 24px rgba(23, 104, 239, 0.45);
}

.mark::after {
    content: '';
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.85);
    border-radius: 50%;
}

.code {
    margin: 0;
    font-family: 'Unbounded', sans-serif;
    font-size: clamp(72px, 16vw, 148px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    text-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

h1 {
    margin: 20px 0 12px;
    font-family: 'Unbounded', sans-serif;
    font-size: clamp(20px, 3.4vw, 28px);
    font-weight: 700;
    letter-spacing: -0.01em;
}

p {
    margin: 0 auto;
    max-width: 420px;
    color: rgba(248, 248, 249, 0.78);
    font-size: 15px;
    line-height: 1.6;
}

a {
    color: #fff;
    text-decoration-color: rgba(255, 255, 255, 0.4);
}

.brand {
    margin-top: 44px;
    color: rgba(248, 248, 249, 0.5);
    font-size: 13px;
    letter-spacing: 0.02em;
}
</style>
</head>
<body>
<div class="card">
    <span class="mark" aria-hidden="true"></span>
    <p class="code">503</p>
    <h1>Страница временно закрыта</h1>
    <p>
        Мы сейчас здесь кое-что настраиваем. Скоро всё снова заработает —
        загляните чуть позже. Если срочно, пишите на
        <a href="mailto:support@extree.tech">support@extree.tech</a>.
    </p>
    <div class="brand">extree.tech</div>
</div>
</body>
</html>
`;
