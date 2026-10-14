import { Route, Routes } from 'react-router-dom';
import { VisitkaPage } from '../pages/visitka';
import { SiteAdminPage } from '../pages/site-admin';
import { LoginPage } from '../pages/login';
import { DashboardPage } from '../pages/dashboard';
import { BotSettingsPage } from '../pages/bot-settings';
import { BotStatusPage } from '../pages/bot-status';
import { VoiceSettingsPage } from '../pages/voice-settings';
import { MembersPage } from '../pages/guild-members';
import { MutedPage } from '../pages/muted-members';
import { BannedPage } from '../pages/banned-members';
import { LeaderboardPage } from '../pages/leaderboard';
import { AdminShell } from '../widgets/admin-shell';

// Один билд на оба домена: extree.tech проксирует "/" и "/admin" на этот
// процесс, bot.extree.tech — "/dashboard*" целиком (см. web/Caddyfile),
// поэтому вложенные /dashboard/* уже проксируются без правки Caddyfile.
// Все страницы кабинета — дети AdminShell: он один раз проверяет права
// администратора и держит сайдбар, страницы внутри (через <Outlet/>)
// только грузят свои данные.
export function App() {
    return (
        <Routes>
            <Route path="/" element={<VisitkaPage />} />
            <Route path="/admin" element={<SiteAdminPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AdminShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/members" element={<MembersPage />} />
                <Route path="/dashboard/muted" element={<MutedPage />} />
                <Route path="/dashboard/banned" element={<BannedPage />} />
                <Route path="/dashboard/leaderboard" element={<LeaderboardPage />} />
                <Route path="/dashboard/settings" element={<BotSettingsPage />} />
                <Route path="/dashboard/status" element={<BotStatusPage />} />
                <Route path="/dashboard/voice" element={<VoiceSettingsPage />} />
            </Route>
        </Routes>
    );
}
