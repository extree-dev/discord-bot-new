import { Route, Routes } from 'react-router-dom';
import { VisitkaPage } from '../pages/visitka/VisitkaPage';
import { SiteAdminPage } from '../pages/site-admin/SiteAdminPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { BotSettingsPage } from '../pages/bot-settings/BotSettingsPage';
import { BotStatusPage } from '../pages/bot-status/BotStatusPage';
import { VoiceSettingsPage } from '../pages/voice-settings/VoiceSettingsPage';
import { AdminShell } from '../widgets/admin-shell/AdminShell';

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
            <Route element={<AdminShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/settings" element={<BotSettingsPage />} />
                <Route path="/dashboard/status" element={<BotStatusPage />} />
                <Route path="/dashboard/voice" element={<VoiceSettingsPage />} />
            </Route>
        </Routes>
    );
}
