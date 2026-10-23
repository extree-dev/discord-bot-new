import { createContext } from 'react';
import type { AccountState } from '../api/statsAuth';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'banned';

export interface AuthContextValue {
    status: AuthStatus;
    user: AccountState['user'];
    banned: boolean;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

// Сам контекст — отдельным файлом, чтобы useAuth.ts (хук) и
// AuthProvider.tsx (компонент) не создавали циклическую зависимость
// и чтобы react-refresh не ругался.
export const AuthContext = createContext<AuthContextValue | null>(null);
