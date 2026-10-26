import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

interface GuestOnlyRouteProps {
    children: ReactNode;
}

// SRP: обратный гейт. Пускает только НЕ залогиненных. Если залогинен —
// сразу на /account, без показа формы /login или /register.
//
// Loading: рендерим children (страница /login показывается мгновенно,
// но если статус станет authenticated — редирект произойдёт до первого
// рендера формы благодаря useMemo в AuthProvider).
export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
    const { status } = useAuth();

    if (status === 'loading') {
        return <>{children}</>;
    }
    if (status === 'authenticated') {
        return <Navigate to="/account" replace />;
    }
    return <>{children}</>;
}
