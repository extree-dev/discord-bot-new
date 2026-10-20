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
import { RiotLookupPage } from '../pages/riot-lookup';

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
            <Route path="/riot-lookup" element={<RiotLookupPage />} />
        </Routes>
    );
}
