import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { App } from './app/App';
import { AuthProvider } from './shared/auth/AuthProvider';
import { SENTRY_DSN } from './shared/config';
import './app/styles/global.css';

Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Sentry.ErrorBoundary
            fallback={() => (
                <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
                    Something went wrong. Please refresh the page.
                </div>
            )}
        >
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </Sentry.ErrorBoundary>
    </StrictMode>
);
