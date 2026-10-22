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
import { AdminTicketsPage } from '../pages/admin-tickets';
import { AdminTicketPage } from '../pages/admin-ticket';
import { AccountSettingsPage } from '../pages/account-settings';
import { AdminUsersPage } from '../pages/admin-users';

// RiotLookupPage (pages/riot-lookup) намеренно не подключена сюда — см.
// обсуждение в PR #307: страница рабочая и готова, но пока убрана с
// публичного сайта, чтобы не привлекать лишнего внимания Riot к продукту,
// пока заявка на RSO/VALORANT API ещё Pending Review. Раскомментировать
// импорт и роут ниже, когда будет смысл её снова показывать.

export function App() {
    return (
        <Routes>
            <Route path="/" element={<SignInPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/verify-location" element={<VerifyLocationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/account/settings" element={<AccountSettingsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/support/ticket/:token" element={<TicketPage />} />
            <Route path="/admin/tickets" element={<AdminTicketsPage />} />
            <Route path="/admin/tickets/:number" element={<AdminTicketPage />} />
        </Routes>
    );
}
