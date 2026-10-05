import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import { getSiteAdminStatus, getSiteContent } from '../../entities/site-content/api';
import type { SiteContentResponse } from '../../entities/site-content/types';
import { SiteContentForm } from '../../features/edit-site-content/SiteContentForm';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Card } from '../../shared/ui/Card';

type ViewState =
    { kind: 'loading' } | { kind: 'logged-out' } | { kind: 'denied' } | { kind: 'admin'; content: SiteContentResponse };

export function SiteAdminPage() {
    const [state, setState] = useState<ViewState>({ kind: 'loading' });

    useEffect(() => {
        document.title = 'Редактирование визитки — Extree';

        let cancelled = false;
        (async () => {
            const { user } = await getSession();
            if (cancelled) return;
            if (!user) {
                setState({ kind: 'logged-out' });
                return;
            }

            const { isAdmin } = await getSiteAdminStatus();
            if (cancelled) return;
            if (!isAdmin) {
                setState({ kind: 'denied' });
                return;
            }

            const content = await getSiteContent();
            if (!cancelled) setState({ kind: 'admin', content });
        })().catch(() => {
            if (!cancelled) setState({ kind: 'logged-out' });
        });

        return () => {
            cancelled = true;
        };
    }, []);

    if (state.kind === 'loading') return null;

    if (state.kind === 'logged-out') {
        return (
            <Card>
                <h1>Редактирование визитки</h1>
                <p>Войди через Discord — редактировать может только администратор сервера бота.</p>
                <LoginButton />
            </Card>
        );
    }

    if (state.kind === 'denied') {
        return (
            <Card>
                <h1>Нет доступа</h1>
                <p>Редактировать визитку может только администратор сервера, на котором работает бот.</p>
                <LogoutButton />
            </Card>
        );
    }

    return (
        <Card wide>
            <h1>Редактирование визитки</h1>
            <p>Правки применяются сразу — без деплоя. Пустой URL у ссылки делает её просто текстом.</p>
            <SiteContentForm initial={state.content} maxLinks={state.content.maxLinks} />
            <LogoutButton />
        </Card>
    );
}
