import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { getManagedGuilds } from '../../entities/guild/api';
import type { ManagedGuild } from '../../entities/guild/types';
import { getGuildStats } from '../../entities/guild-stats/api';
import type { GuildStats } from '../../entities/guild-stats/types';
import { useLang } from '../../shared/lib/useLang';
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
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('nav.overview')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
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
                <h1>{t('overview.greeting', { name: user.username })}</h1>
                <p>{t('overview.subtitle')}</p>
                <GuildList guilds={guilds} />
                <p className={styles.note}>{t('overview.listNote')}</p>
            </Card>

            {stats && (
                <div className={styles.statGrid}>
                    <StatTile label={t('overview.statMembers')} value={stats.memberCount} />
                    <StatTile
                        label={t('overview.statOnline')}
                        value={stats.onlineCount}
                        hint={t('overview.statOnlineHint')}
                    />
                    <StatTile
                        label={t('overview.statModeration')}
                        value={stats.recentCases}
                        hint={t('overview.statModerationHint')}
                    />
                    <StatTile label={t('overview.statTickets')} value={stats.openTickets} />
                    <StatTile
                        label={t('overview.statSecurity')}
                        value={`${stats.securityModulesActive} / ${stats.securityModulesTotal}`}
                        hint={t('overview.statSecurityHint')}
                    />
                </div>
            )}

            <LinkedAccountsCard />
        </div>
    );
}
