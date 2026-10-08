import { useEffect, useState } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContentResponse } from '../../entities/site-content/types';
import { SiteContentForm } from '../../features/edit-site-content/SiteContentForm';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { LinkChainIcon, ShieldIcon } from '../../shared/ui/icons';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { gateNoticeMessage } from '../../shared/lib/gateNotice';
import { AppShell } from '../../widgets/app-shell/AppShell';
import { LoginMethods } from '../../widgets/login-methods/LoginMethods';
import styles from './SiteAdminPage.module.css';

export function SiteAdminPage() {
    const { status, notice } = useSiteAdminGate();
    const [content, setContent] = useState<SiteContentResponse | null>(null);

    useEffect(() => {
        document.title = 'Редактирование визитки — Extree';
    }, []);

    useEffect(() => {
        if (status !== 'admin') return;
        let cancelled = false;
        getSiteContent().then(c => {
            if (!cancelled) setContent(c);
        });
        return () => {
            cancelled = true;
        };
    }, [status]);

    return (
        <AppShell>
            {status === 'logged-out' && (
                <Card>
                    <span className={styles.gateIcon}>
                        <LinkChainIcon />
                    </span>
                    <h1>Редактирование визитки</h1>
                    <p>Войди через Discord — редактировать может только администратор сервера бота.</p>
                    {notice && (
                        <Notice variant={gateNoticeMessage(notice).variant}>{gateNoticeMessage(notice).text}</Notice>
                    )}
                    <LoginMethods />
                </Card>
            )}

            {status === 'denied' && (
                <Card>
                    <span className={`${styles.gateIcon} ${styles.gateIconDanger}`}>
                        <ShieldIcon />
                    </span>
                    <h1>Нет доступа</h1>
                    <p>Редактировать визитку может только администратор сервера, на котором работает бот.</p>
                    <LogoutButton />
                </Card>
            )}

            {status === 'admin' && content && (
                <Card wide>
                    <div className={styles.header}>
                        <span className={styles.headerIcon}>
                            <LinkChainIcon />
                        </span>
                        <h1>Редактирование визитки</h1>
                        <p className={styles.headerSubtitle}>
                            Правки применяются сразу — без деплоя. Пустой URL у ссылки делает её просто текстом.
                        </p>
                    </div>
                    <div className={styles.divider} />
                    <SiteContentForm initial={content} maxLinks={content.maxLinks} />
                    <div className={styles.logout}>
                        <LogoutButton />
                    </div>
                </Card>
            )}
        </AppShell>
    );
}
