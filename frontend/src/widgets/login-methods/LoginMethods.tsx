import { useEffect, useState } from 'react';
import { getAuthMethods } from '../../entities/auth-methods/api';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { EmailLoginForm } from '../../features/email-auth/EmailLoginForm';
import { TelegramLoginButton } from '../../features/telegram-auth/TelegramLoginButton';
import { GoogleLoginButton } from '../../features/google-auth/GoogleLoginButton';
import { GitHubLoginButton } from '../../features/github-auth/GitHubLoginButton';
import { isDashboardDomain } from '../../shared/lib/isDashboardDomain';
import { useLang } from '../../shared/lib/useLang';
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
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const [githubEnabled, setGithubEnabled] = useState(false);
    const { t } = useLang();

    useEffect(() => {
        getAuthMethods()
            .then(({ telegram, google, github }) => {
                setTelegramBotUsername(telegram?.botUsername ?? null);
                setGoogleEnabled(Boolean(google));
                setGithubEnabled(Boolean(github));
            })
            .catch(() => {
                setTelegramBotUsername(null);
                setGoogleEnabled(false);
                setGithubEnabled(false);
            });
    }, []);

    return (
        <div className={styles.wrapper}>
            <LoginButton label={t('login.discord')} />
            {googleEnabled && <GoogleLoginButton label={t('login.google')} />}
            {githubEnabled && <GitHubLoginButton label={t('login.github')} />}
            {telegramBotUsername && isDashboardDomain() && (
                <div className={styles.telegram}>
                    <TelegramLoginButton botUsername={telegramBotUsername} />
                </div>
            )}
            <div className={styles.divider}>{t('login.or')}</div>
            <EmailLoginForm />
        </div>
    );
}
