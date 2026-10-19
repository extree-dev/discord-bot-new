import { Route, Routes } from 'react-router-dom';
import { SignInPage } from '../pages/sign-in';
import { TermsPage } from '../pages/terms';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<SignInPage />} />
            <Route path="/terms" element={<TermsPage />} />
        </Routes>
    );
}
