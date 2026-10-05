import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import { getSiteAdminStatus } from '../../entities/site-admin/api';

export type SiteAdminGateStatus = 'loading' | 'logged-out' | 'denied' | 'admin';

// Общий гейт для всех страниц, редактирование на которых доступно только
// администратору сервера бота (/admin, /dashboard/settings, что добавится
// следом) — session → site-admin-status, без дублирования в каждой
// странице её собственным useEffect.
export function useSiteAdminGate(): SiteAdminGateStatus {
    const [status, setStatus] = useState<SiteAdminGateStatus>('loading');

    useEffect(() => {
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

    return status;
}
