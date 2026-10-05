import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { getManagedGuilds } from '../../entities/guild/api';
import type { ManagedGuild } from '../../entities/guild/types';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { consumeAuthErrorFlag } from '../../shared/lib/authError';
import { AppShell } from '../../widgets/app-shell/AppShell';
import { GuildList } from '../../widgets/guild-list/GuildList';
import styles from './DashboardPage.module.css';

type ViewState =
    { kind: 'loading' } | { kind: 'logged-out' } | { kind: 'logged-in'; user: SessionUser; guilds: ManagedGuild[] };

export function DashboardPage() {
    const [state, setState] = useState<ViewState>({ kind: 'loading' });
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        document.title = 'Кабинет — Extree';
        setAuthError(consumeAuthErrorFlag());

        let cancelled = false;
        (async () => {
            const { user } = await getSession();
            if (cancelled) return;
            if (!user) {
                setState({ kind: 'logged-out' });
                return;
            }

            const { guilds } = await getManagedGuilds();
            if (!cancelled) setState({ kind: 'logged-in', user, guilds });
        })().catch(() => {
            if (!cancelled) setState({ kind: 'logged-out' });
        });

        return () => {
            cancelled = true;
        };
    }, []);

    if (state.kind === 'loading') return <AppShell>{null}</AppShell>;

    if (state.kind === 'logged-out') {
        return (
            <AppShell>
                <Card>
                    <h1>Личный кабинет</h1>
                    <p>Войди через Discord, чтобы увидеть сервера, на которых есть и ты, и бот.</p>
                    {authError && (
                        <Notice variant="error">Вход не завершился — ссылка устарела. Попробуй ещё раз.</Notice>
                    )}
                    <LoginButton />
                </Card>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <Card>
                <Avatar src={state.user.avatarUrl} alt="" size="small" />
                <h1>Привет, {state.user.username}</h1>
                <p>Сервера, где есть и ты (с правами администратора), и бот Extree.</p>
                <GuildList guilds={state.guilds} />
                <Button href="/dashboard/settings" fullWidth>
                    Настройки бота
                </Button>
                <p className={styles.note}>
                    Список серверов — пока только просмотр. Настройки бота (кнопка выше) уже можно менять — доступно
                    администратору сервера, на котором работает Extree.
                </p>
                <LogoutButton />
            </Card>
        </AppShell>
    );
}
