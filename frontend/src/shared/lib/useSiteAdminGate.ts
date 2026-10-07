import { useEffect, useState } from 'react';
import { getSession } from '../../entities/session/api';
import { getSiteAdminStatus } from '../../entities/site-admin/api';
import { consumeGateNotice, type GateNotice } from './gateNotice';

export type SiteAdminGateStatus = 'loading' | 'logged-out' | 'denied' | 'admin';

export interface SiteAdminGateResult {
    status: SiteAdminGateStatus;
    notice: GateNotice | null;
}

// Общий гейт для всех страниц, редактирование на которых доступно только
// администратору сервера бота (/admin, /dashboard/settings) — session →
// site-admin-status, без дублирования в каждой странице её собственным
// useEffect. notice — пришёл ли редирект с одним из флагов gateNotice.ts
// (просроченная OAuth-ссылка, Telegram ещё ни к чему не привязан и т.п.):
// без этого человек просто видит тот же экран логина заново и не
// понимает, что произошло.
export function useSiteAdminGate(): SiteAdminGateResult {
    const [status, setStatus] = useState<SiteAdminGateStatus>('loading');
    const [notice, setNotice] = useState<GateNotice | null>(null);

    useEffect(() => {
        const gateNotice = consumeGateNotice();
        if (gateNotice) setNotice(gateNotice);

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

    return { status, notice };
}
