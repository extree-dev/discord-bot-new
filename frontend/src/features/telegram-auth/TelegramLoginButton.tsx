import { useEffect, useRef } from 'react';

interface TelegramLoginButtonProps {
    botUsername: string;
}

// Официальный Telegram Login Widget — не React-компонент, а внешний
// скрипт, который сам заменяет контейнер на iframe с кнопкой. Нужно
// создавать <script> через DOM API (document.createElement), а не
// рендерить его через JSX: виджет сам ищет себя в DOM по соседству и
// должен быть вставлен именно так, как описано в документации Telegram
// (https://core.telegram.org/widgets/login).
//
// data-auth-url — абсолютный URL, домен должен совпадать с тем, что
// привязан к боту в @BotFather (/setdomain) — у нас два домена
// (bot.extree.tech, extree.tech), оба должны быть прописаны там.
export function TelegramLoginButton({ botUsername }: TelegramLoginButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.async = true;
        script.setAttribute('data-telegram-login', botUsername);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '10');
        script.setAttribute('data-auth-url', `${window.location.origin}/auth/telegram/callback`);
        script.setAttribute('data-request-access', 'write');
        container.appendChild(script);

        return () => {
            container.innerHTML = '';
        };
    }, [botUsername]);

    return <div ref={containerRef} />;
}
