import { useEffect, useState } from 'react';
import { getAuthMethods } from '../../entities/auth-methods/api';
import { getLinkedAccounts } from '../../entities/linked-accounts/api';
import type { LinkedAccounts } from '../../entities/linked-accounts/types';
import { SetPasswordForm } from '../../features/email-auth/SetPasswordForm';
import { TelegramLoginButton } from '../../features/telegram-auth/TelegramLoginButton';
import { isDashboardDomain } from '../../shared/lib/isDashboardDomain';
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
    const [settingPassword, setSettingPassword] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getLinkedAccounts(), getAuthMethods()]).then(([accounts, methods]) => {
            if (cancelled) return;
            setLinked(accounts);
            setTelegramBotUsername(methods.telegram?.botUsername ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!linked) return null;

    return (
        <Card wide>
            <h2>Способы входа</h2>
            <p className={styles.status}>
                Если Discord недоступен напрямую — можно войти в этот кабинет через Telegram или email, права при этом
                не меняются.
            </p>

            <div className={styles.row}>
                <span className={styles.label}>Discord</span>
                <span className={`${styles.status} ${styles.linked}`}>@{linked.discordUsername}</span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>Telegram</span>
                {linked.telegramUsername ? (
                    <span className={`${styles.status} ${styles.linked}`}>@{linked.telegramUsername}</span>
                ) : telegramBotUsername && isDashboardDomain() ? (
                    <TelegramLoginButton botUsername={telegramBotUsername} />
                ) : (
                    <span className={styles.status}>не настроено</span>
                )}
            </div>

            <div className={styles.row}>
                <span className={styles.label}>Email и пароль</span>
                {linked.hasPassword && !settingPassword ? (
                    <span className={styles.status}>
                        {linked.email} ·{' '}
                        <button type="button" className={styles.linkButton} onClick={() => setSettingPassword(true)}>
                            изменить
                        </button>
                    </span>
                ) : !settingPassword ? (
                    <button type="button" className={styles.linkButton} onClick={() => setSettingPassword(true)}>
                        подключить
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
