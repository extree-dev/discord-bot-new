import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { getManagedGuilds } from '../../entities/guild/api';
import type { ManagedGuild } from '../../entities/guild/types';
import { Avatar } from '../../shared/ui/Avatar';
import { Card } from '../../shared/ui/Card';
import { GuildList } from '../../widgets/guild-list/GuildList';
import { LinkedAccountsCard } from '../../widgets/linked-accounts/LinkedAccountsCard';
import styles from './DashboardPage.module.css';

type ViewState = { kind: 'loading' } | { kind: 'loaded'; user: SessionUser; guilds: ManagedGuild[] };

// Гейт ("вошёл ли администратор сервера бота") теперь целиком в
// AdminShell (widgets/admin-shell) — эта страница рендерится только
// внутри него, через <Outlet/>, так что здесь остаётся только загрузка
// собственных данных обзора.
export function DashboardPage() {
    const [state, setState] = useState<ViewState>({ kind: 'loading' });

    useEffect(() => {
        document.title = 'Обзор — Extree';

        let cancelled = false;
        (async () => {
            const [{ user }, { guilds }] = await Promise.all([getSession(), getManagedGuilds()]);
            if (!cancelled && user) setState({ kind: 'loaded', user, guilds });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (state.kind === 'loading') return null;

    return (
        <div className={styles.stack}>
            <Card wide>
                <Avatar src={state.user.avatarUrl} alt="" size="small" />
                <h1>Привет, {state.user.username}</h1>
                <p>Сервера, где есть и ты (с правами администратора), и бот Extree.</p>
                <GuildList guilds={state.guilds} />
                <p className={styles.note}>
                    Список серверов — пока только просмотр. Настройки и статус бота — в меню слева, применяются сразу.
                </p>
            </Card>
            <LinkedAccountsCard />
        </div>
    );
}
