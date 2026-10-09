import { useEffect, useState } from 'react';
import { getAuthMethods } from '../../entities/auth-methods/api';
import { getLinkedAccounts } from '../../entities/linked-accounts/api';
import type { LinkedAccounts } from '../../entities/linked-accounts/types';
import { SetPasswordForm } from '../../features/email-auth/SetPasswordForm';
import { TelegramLoginButton } from '../../features/telegram-auth/TelegramLoginButton';
import { GoogleLoginButton } from '../../features/google-auth/GoogleLoginButton';
import { GitHubLoginButton } from '../../features/github-auth/GitHubLoginButton';
import { isDashboardDomain } from '../../shared/lib/isDashboardDomain';
import { useLang } from '../../shared/lib/useLang';
import { Card } from '../../shared/ui/Card';
import styles from './LinkedAccountsCard.module.css';

// Способы входа в кабинет — зачем они нужны отдельной карточкой на
// "Обзоре": discord.com у части пользователей бывает недоступен
// напрямую, а Telegram/email ведут в тот же аккаунт (права по-прежнему
// проверяются по привязанному discordId, см. dashboard/server.js
// isRequestSiteAdmin) — так что это запасной вход, а не отдельная
// система прав.
export function LinkedAccountsCard() {
    const [linked, setLinked] = useState<LinkedAccounts | null>(null);
    const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const [githubEnabled, setGithubEnabled] = useState(false);
    const [settingPassword, setSettingPassword] = useState(false);
    const { t } = useLang();

    useEffect(() => {
        let cancelled = false;
        Promise.all([getLinkedAccounts(), getAuthMethods()]).then(([accounts, methods]) => {
            if (cancelled) return;
            setLinked(accounts);
            setTelegramBotUsername(methods.telegram?.botUsername ?? null);
            setGoogleEnabled(Boolean(methods.google));
            setGithubEnabled(Boolean(methods.github));
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!linked) return null;

    return (
        <Card wide>
            <h2>{t('linkedAccounts.title')}</h2>
            <p className={styles.status}>{t('linkedAccounts.subtitle')}</p>

            <div className={styles.row}>
                <span className={styles.label}>{t('linkedAccounts.discord')}</span>
                <span className={`${styles.status} ${styles.linked}`}>@{linked.discordUsername}</span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('linkedAccounts.telegram')}</span>
                {linked.telegramUsername ? (
                    <span className={`${styles.status} ${styles.linked}`}>@{linked.telegramUsername}</span>
                ) : telegramBotUsername && isDashboardDomain() ? (
                    <TelegramLoginButton botUsername={telegramBotUsername} />
                ) : (
                    <span className={styles.status}>{t('linkedAccounts.notConfigured')}</span>
                )}
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('linkedAccounts.google')}</span>
                {linked.googleEmail ? (
                    <span className={`${styles.status} ${styles.linked}`}>{linked.googleEmail}</span>
                ) : googleEnabled ? (
                    <GoogleLoginButton label={t('linkedAccounts.connect')} fullWidth={false} />
                ) : (
                    <span className={styles.status}>{t('linkedAccounts.notConfigured')}</span>
                )}
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('linkedAccounts.github')}</span>
                {linked.githubUsername ? (
                    <span className={`${styles.status} ${styles.linked}`}>@{linked.githubUsername}</span>
                ) : githubEnabled ? (
                    <GitHubLoginButton label={t('linkedAccounts.connect')} fullWidth={false} />
                ) : (
                    <span className={styles.status}>{t('linkedAccounts.notConfigured')}</span>
                )}
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('linkedAccounts.email')}</span>
                {linked.hasPassword && !settingPassword ? (
                    <span className={styles.status}>
                        {linked.email} ·{' '}
                        <button type="button" className={styles.linkButton} onClick={() => setSettingPassword(true)}>
                            {t('linkedAccounts.change')}
                        </button>
                    </span>
                ) : !settingPassword ? (
                    <button type="button" className={styles.linkButton} onClick={() => setSettingPassword(true)}>
                        {t('linkedAccounts.connect')}
                    </button>
                ) : null}
            </div>
            {settingPassword && (
                <div className={styles.expanded}>
                    <SetPasswordForm
                        currentEmail={linked.email}
                        onLinked={email => {
                            setLinked({ ...linked, hasPassword: true, email });
                            setSettingPassword(false);
                        }}
                    />
                </div>
            )}
        </Card>
    );
}
