import { Route, Routes } from 'react-router-dom';
import { VisitkaPage } from '../pages/visitka/VisitkaPage';
import { SiteAdminPage } from '../pages/site-admin/SiteAdminPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';

// Один билд на оба домена: extree.tech проксирует "/" и "/admin" на этот
// процесс, bot.extree.tech — только "/dashboard" (см. web/Caddyfile).
// Маршруты не пересекаются по смыслу, поэтому определять их все здесь
// безопасно — какой из них реально достижим, решает Caddy, а не этот код.
export function App() {
    return (
        <Routes>
            <Route path="/" element={<VisitkaPage />} />
            <Route path="/admin" element={<SiteAdminPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
    );
}
