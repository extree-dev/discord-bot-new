import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import { getSiteAdminStatus } from '../../entities/site-admin/api';
import { consumeAuthErrorFlag } from './authError';

export type SiteAdminGateStatus = 'loading' | 'logged-out' | 'denied' | 'admin';

export interface SiteAdminGateResult {
    status: SiteAdminGateStatus;
    authError: boolean;
}

// Общий гейт для всех страниц, редактирование на которых доступно только
// администратору сервера бота (/admin, /dashboard/settings) — session →
// site-admin-status, без дублирования в каждой странице её собственным
// useEffect. authError — пришёл ли редирект от /auth/discord/callback с
// ?auth_error=1 (просроченная ссылка входа, Discord не ответил на обмен
// кода на токен): без этого человек просто видит тот же экран логина
// заново и не понимает, что попытка входа не удалась.
export function useSiteAdminGate(): SiteAdminGateResult {
    const [status, setStatus] = useState<SiteAdminGateStatus>('loading');
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        if (consumeAuthErrorFlag()) setAuthError(true);

        let cancelled = false;
        (async () => {
            const { user } = await getSession();
            if (cancelled) return;
            if (!user) {
                setStatus('logged-out');
                return;
            }
            const { isAdmin } = await getSiteAdminStatus();
            if (!cancelled) setStatus(isAdmin ? 'admin' : 'denied');
        })().catch(() => {
            if (!cancelled) setStatus('logged-out');
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return { status, authError };
}
