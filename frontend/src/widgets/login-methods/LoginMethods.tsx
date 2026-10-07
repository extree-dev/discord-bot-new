import { useEffect, useState } from 'react';
import { getAuthMethods } from '../../entities/auth-methods/api';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { EmailLoginForm } from '../../features/email-auth/EmailLoginForm';
import { TelegramLoginButton } from '../../features/telegram-auth/TelegramLoginButton';
import { isDashboardDomain } from '../../shared/lib/isDashboardDomain';
import styles from './LoginMethods.module.css';

// Все способы входа на одном экране логина (AdminShell, SiteAdminPage):
// Discord — всегда, он единственный, которым можно изначально создать
// аккаунт (см. dashboard/accounts.js); Telegram — только если бэкенд
// настроен И мы на bot.extree.tech (виджет в @BotFather привязывается
// ровно к одному домену, на extree.tech он всё равно не заработает —
// см. isDashboardDomain); email — работает только для аккаунтов, где
// пароль уже был привязан заранее (через настройки, уже будучи вошедшим).
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
            {telegramBotUsername && isDashboardDomain() && (
                <div className={styles.telegram}>
                    <TelegramLoginButton botUsername={telegramBotUsername} />
                </div>
            )}
            <div className={styles.divider}>или</div>
            <EmailLoginForm />
        </div>
    );
}
