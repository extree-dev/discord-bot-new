import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

interface ProtectedRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
}

// SRP: только гейт. Не знает про конкретную страницу, только про статус
// авторизации.
//
// Поведение:
// - loading → рендерим children (страница сама покажет skeleton/loader,
//   если нужно). Так избегаем "мигания" на /login при переходе.
// - anonymous → /login
// - banned → /login (или можно /banned, но пока просто /login)
// - authenticated + adminOnly + не админ → /
// - иначе → children
export function ProtectedRoute({ children, adminOnly }: ProtectedRouteProps) {
    const { status, user } = useAuth();

    if (status === 'loading') {
        return <>{children}</>;
    }
    if (status === 'anonymous' || status === 'banned') {
        return <Navigate to="/login" replace />;
    }
    if (adminOnly && !user?.isAdmin) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}
