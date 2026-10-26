import * as Sentry from '@sentry/react';
import { SENTRY_DSN } from '../config';

// Вызывается только после согласия на категорию "Error monitoring" (или
// сразу при загрузке, если согласие уже сохранено с прошлого визита) —
// до этого Sentry.init() не вызывается вообще нигде в приложении, см.
// main.tsx. Idempotent-флаг — ConsentProvider может звать это при каждом
// изменении согласия, не только один раз.
let sentryInitialized = false;

export function enableSentry(): void {
    if (sentryInitialized) return;
    sentryInitialized = true;
    Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
    });
}

// Раньше эти три <link> были статикой в index.html — то есть Google видел
// заход на сайт (через preconnect) и получал запрос на шрифт ещё до того,
// как посетитель вообще увидел баннер согласия. Теперь — только после
// согласия на категорию "Fonts" (или сразу, если согласие уже есть):
// добавляем те же три тега в <head> вручную. body уже имеет полноценный
// fallback-стек (-apple-system/Segoe UI/Roboto/sans-serif, см.
// app/styles/global.css), так что без этого согласия сайт просто
// выглядит чуть иначе, а не ломается.
const GOOGLE_FONTS_STYLESHEET_ID = 'google-fonts-inter';

export function enableGoogleFonts(): void {
    if (document.getElementById(GOOGLE_FONTS_STYLESHEET_ID)) return;

    const preconnectApis = document.createElement('link');
    preconnectApis.rel = 'preconnect';
    preconnectApis.href = 'https://fonts.googleapis.com';

    const preconnectStatic = document.createElement('link');
    preconnectStatic.rel = 'preconnect';
    preconnectStatic.href = 'https://fonts.gstatic.com';
    preconnectStatic.crossOrigin = 'anonymous';

    const stylesheet = document.createElement('link');
    stylesheet.id = GOOGLE_FONTS_STYLESHEET_ID;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';

    document.head.append(preconnectApis, preconnectStatic, stylesheet);
}

export function applyConsent(categories: { analytics: boolean; preferences: boolean }): void {
    if (categories.analytics) enableSentry();
    if (categories.preferences) enableGoogleFonts();
}
