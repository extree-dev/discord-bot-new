import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { getManagedGuilds } from '../../entities/guild/api';
import type { ManagedGuild } from '../../entities/guild/types';
import { getGuildStats } from '../../entities/guild-stats/api';
import type { GuildStats } from '../../entities/guild-stats/types';
import { Avatar } from '../../shared/ui/Avatar';
import { Card } from '../../shared/ui/Card';
import { StatTile } from '../../shared/ui/StatTile';
import { GuildList } from '../../widgets/guild-list/GuildList';
import { LinkedAccountsCard } from '../../widgets/linked-accounts/LinkedAccountsCard';
import styles from './DashboardPage.module.css';

type ViewState =
    { kind: 'loading' } | { kind: 'loaded'; user: SessionUser; guilds: ManagedGuild[]; stats: GuildStats | null };

// Гейт ("вошёл ли администратор сервера бота") теперь целиком в
// AdminShell (widgets/admin-shell) — эта страница рендерится только
// внутри него, через <Outlet/>, так что здесь остаётся только загрузка
// собственных данных обзора. stats грузится отдельным промисом и может
// остаться null (Discord недоступен и т.п.) — это не должно блокировать
// рендер остальной страницы, поэтому не в Promise.all с остальным.
export function DashboardPage() {
    const [state, setState] = useState<ViewState>({ kind: 'loading' });

    useEffect(() => {
        document.title = 'Обзор — Extree';

        let cancelled = false;
        (async () => {
            const [{ user }, { guilds }] = await Promise.all([getSession(), getManagedGuilds()]);
            if (cancelled || !user) return;
            setState({ kind: 'loaded', user, guilds, stats: null });
            try {
                const stats = await getGuildStats();
                if (!cancelled) setState(s => (s.kind === 'loaded' ? { ...s, stats } : s));
            } catch {
                // карточки статистики просто не покажутся — не критично
                // для остальной страницы.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (state.kind === 'loading') return null;

    const { user, guilds, stats } = state;

    return (
        <div className={styles.stack}>
            <Card wide>
                <Avatar src={user.avatarUrl} alt="" size="small" />
                <h1>Привет, {user.username}</h1>
                <p>Сервера, где есть и ты (с правами администратора), и бот Extree.</p>
                <GuildList guilds={guilds} />
                <p className={styles.note}>
                    Список серверов — пока только просмотр. Настройки и статус бота — в меню слева, применяются сразу.
                </p>
            </Card>

            {stats && (
                <div className={styles.statGrid}>
                    <StatTile label="Участников на сервере" value={stats.memberCount} />
                    <StatTile label="Онлайн сейчас" value={stats.onlineCount} hint="приблизительно, от Discord" />
                    <StatTile label="Модерации за 24ч" value={stats.recentCases} hint="warn / timeout / ban / kick" />
                    <StatTile label="Открытых тикетов" value={stats.openTickets} />
                    <StatTile
                        label="Модулей защиты активно"
                        value={`${stats.securityModulesActive} / ${stats.securityModulesTotal}`}
                        hint="automod, raid shield, anti-nuke"
                    />
                </div>
            )}

            <LinkedAccountsCard />
        </div>
    );
}
