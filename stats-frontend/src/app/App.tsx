import { Route, Routes } from 'react-router-dom';
import { SignInPage } from '../pages/sign-in';
import { TermsPage } from '../pages/terms';
import { PrivacyPage } from '../pages/privacy';
import { CookiesPage } from '../pages/cookies';
import { RegisterPage } from '../pages/register';
import { LoginPage } from '../pages/login';
import { VerifyPage } from '../pages/verify';
import { VerifyLocationPage } from '../pages/verify-location';
import { ForgotPasswordPage } from '../pages/forgot-password';
import { ResetPasswordPage } from '../pages/reset-password';
import { AccountPage } from '../pages/account';
import { SupportPage } from '../pages/support';
import { TicketPage } from '../pages/ticket';
import { AdminTicketsLayout } from '../widgets/admin-tickets-layout';
import { AdminTicketsPlaceholder } from '../pages/admin-tickets-placeholder';
import { AdminTicketPage } from '../pages/admin-ticket';
import { AccountSettingsPage } from '../pages/account-settings';
import { AdminUsersPage } from '../pages/admin-users';
import { AdminAuditPage } from '../pages/admin-audit';
import { ProtectedRoute } from '../shared/auth/ProtectedRoute';
import { GuestOnlyRoute } from '../shared/auth/GuestOnlyRoute';

// RiotLookupPage (pages/riot-lookup) намеренно не подключена сюда — см.
// обсуждение в PR #307: страница рабочая и готова, но пока убрана с
// публичного сайта, чтобы не привлекать лишнего внимания Riot к продукту,
// пока заявка на RSO/VALORANT API ещё Pending Review. Раскомментировать
// импорт и роут ниже, когда будет смысл её снова показывать.

// SRP: App — только карта роутов. Гейты — в <ProtectedRoute>/<GuestOnlyRoute>,
// чтобы App не знал про статус авторизации.
export function App() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={<SignInPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/verify-location" element={<VerifyLocationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/support/ticket/:token" element={<TicketPage />} />

            {/* Guest-only: если уже залогинен — редирект на /account */}
            <Route
                path="/register"
                element={
                    <GuestOnlyRoute>
                        <RegisterPage />
                    </GuestOnlyRoute>
                }
            />
            <Route
                path="/login"
                element={
                    <GuestOnlyRoute>
                        <LoginPage />
                    </GuestOnlyRoute>
                }
            />

            {/* Protected: только залогиненные */}
            <Route
                path="/account"
                element={
                    <ProtectedRoute>
                        <AccountPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/account/settings"
                element={
                    <ProtectedRoute>
                        <AccountSettingsPage />
                    </ProtectedRoute>
                }
            />

            {/* Admin-only */}
            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminUsersPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/audit"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminAuditPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/tickets"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminTicketsLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<AdminTicketsPlaceholder />} />
                <Route path=":number" element={<AdminTicketPage />} />
            </Route>
        </Routes>
    );
}
