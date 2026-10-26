import { useEffect, useRef, useState } from 'react';
import styles from './index.module.scss';

interface TurnstileRenderOptions {
    sitekey: string;
    theme?: 'light' | 'dark' | 'auto';
    callback: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
}

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
            remove: (widgetId: string) => void;
        };
    }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Один и тот же <script> на всё приложение, даже если несколько
// Turnstile-виджетов когда-нибудь окажутся на экране одновременно —
// повторный document.createElement дублировал бы загрузку.
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Turnstile script'));
            document.head.appendChild(script);
        });
    }
    return scriptPromise;
}

interface TurnstileProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onExpire?: () => void;
}

// Виджет капчи Cloudflare Turnstile — используется на pages/login перед
// проверкой пароля (см. verifyTurnstileToken в stats-backend/turnstile.js).
// Рендерится через window.turnstile.render в пустой div, а не через
// data-атрибуты на самом div, — явный рендер проще размонтировать/
// перемонтировать корректно при повторных заходах на страницу логина.
export function Turnstile({ siteKey, onVerify, onExpire }: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadTurnstileScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.turnstile) return;
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    theme: 'dark',
                    callback: onVerify,
                    'expired-callback': () => onExpire?.(),
                    'error-callback': () => setFailed(true),
                });
            })
            .catch(() => setFailed(true));
        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
            }
        };
        // onVerify/onExpire приходят как новые функции на каждый рендер
        // родителя — перезапускать виджет из-за этого не нужно, только
        // если реально сменился siteKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey]);

    if (failed) {
        return <p className={styles.error}>Verification failed to load — refresh the page and try again.</p>;
    }

    return <div ref={containerRef} className={styles.widget} />;
}
