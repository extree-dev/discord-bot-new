import { useEffect, useState } from 'react';
import { getAuthMethods } from '../../entities/auth-methods/api';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { EmailLoginForm } from '../../features/email-auth/EmailLoginForm';
import { TelegramLoginButton } from '../../features/telegram-auth/TelegramLoginButton';
import styles from './LoginMethods.module.css';

// Все способы входа на одном экране логина (AdminShell, SiteAdminPage):
// Discord — всегда, он единственный, которым можно изначально создать
// аккаунт (см. dashboard/accounts.js); Telegram — только если бэкенд
// настроен (TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME), иначе кнопка
// виджета не рендерится вообще, а не показывается сломанной; email —
// работает только для аккаунтов, где пароль уже был привязан заранее
// (через настройки, уже будучи вошедшим).
export function LoginMethods() {
    const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);

    useEffect(() => {
        getAuthMethods()
            .then(({ telegram }) => setTelegramBotUsername(telegram?.botUsername ?? null))
            .catch(() => setTelegramBotUsername(null));
    }, []);

    return (
        <div className={styles.wrapper}>
            <LoginButton />
            {telegramBotUsername && (
                <div className={styles.telegram}>
                    <TelegramLoginButton botUsername={telegramBotUsername} />
                </div>
            )}
            <div className={styles.divider}>или</div>
            <EmailLoginForm />
        </div>
    );
}
