import { useEffect, useState } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContentResponse } from '../../entities/site-content/types';
import { SiteContentForm } from '../../features/edit-site-content/SiteContentForm';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { AppShell } from '../../widgets/app-shell/AppShell';

export function SiteAdminPage() {
    const { status, authError } = useSiteAdminGate();
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
                    <h1>Редактирование визитки</h1>
                    <p>Войди через Discord — редактировать может только администратор сервера бота.</p>
                    {authError && (
                        <Notice variant="error">Вход не завершился — ссылка устарела. Попробуй ещё раз.</Notice>
                    )}
                    <LoginButton />
                </Card>
            )}

            {status === 'denied' && (
                <Card>
                    <h1>Нет доступа</h1>
                    <p>Редактировать визитку может только администратор сервера, на котором работает бот.</p>
                    <LogoutButton />
                </Card>
            )}

            {status === 'admin' && content && (
                <Card wide>
                    <h1>Редактирование визитки</h1>
                    <p>Правки применяются сразу — без деплоя. Пустой URL у ссылки делает её просто текстом.</p>
                    <SiteContentForm initial={content} maxLinks={content.maxLinks} />
                    <LogoutButton />
                </Card>
            )}
        </AppShell>
    );
}
