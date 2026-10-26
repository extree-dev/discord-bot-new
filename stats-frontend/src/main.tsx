import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { App } from './app/App';
import { AuthProvider } from './shared/auth/AuthProvider';
import { ConsentProvider } from './shared/consent/ConsentProvider';
import './app/styles/global.css';

// Sentry.init() больше не вызывается здесь безусловно — только из
// shared/consent/thirdParty.ts (enableSentry), и только после согласия на
// категорию "Error monitoring" (или сразу, если согласие уже было дано в
// прошлый визит — см. ConsentProvider). <Sentry.ErrorBoundary> безопасно
// смонтирован и без вызванного init(): captureException внутри него
// становится no-op, пока клиент не создан, но сам fallback UI на ошибке
// отрисуется как обычно.

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
                <ConsentProvider>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </ConsentProvider>
            </BrowserRouter>
        </Sentry.ErrorBoundary>
    </StrictMode>
);
