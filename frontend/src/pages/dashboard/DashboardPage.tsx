import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { getManagedGuilds } from '../../entities/guild/api';
import type { ManagedGuild } from '../../entities/guild/types';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Avatar } from '../../shared/ui/Avatar';
import { Card } from '../../shared/ui/Card';
import { GuildList } from '../../widgets/guild-list/GuildList';
import styles from './DashboardPage.module.css';

type ViewState =
    { kind: 'loading' } | { kind: 'logged-out' } | { kind: 'logged-in'; user: SessionUser; guilds: ManagedGuild[] };

export function DashboardPage() {
    const [state, setState] = useState<ViewState>({ kind: 'loading' });

    useEffect(() => {
        document.title = 'Кабинет — Extree';

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

    if (state.kind === 'loading') return null;

    if (state.kind === 'logged-out') {
        return (
            <Card>
                <h1>Личный кабинет</h1>
                <p>Войди через Discord, чтобы увидеть сервера, на которых есть и ты, и бот.</p>
                <LoginButton />
            </Card>
        );
    }

    return (
        <Card>
            <Avatar src={state.user.avatarUrl} alt="" size="small" />
            <h1>Привет, {state.user.username}</h1>
            <p>Сервера, где есть и ты (с правами администратора), и бот Extree.</p>
            <GuildList guilds={state.guilds} />
            <p className={styles.note}>
                Пока только просмотр — управление настройками бота прямо отсюда появится позже.
            </p>
            <LogoutButton />
        </Card>
    );
}
