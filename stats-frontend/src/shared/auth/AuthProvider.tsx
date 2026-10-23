import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAccount } from '../api/statsAuth';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [user, setUser] = useState<AuthContextValue['user']>(null);
    const [banned, setBanned] = useState(false);

    const refresh = useCallback(async () => {
        setStatus('loading');
        try {
            const result = await getAccount();
            if (result.banned) {
                setBanned(true);
                setUser(null);
                setStatus('banned');
                return;
            }
            setBanned(false);
            if (result.user) {
                setUser(result.user);
                setStatus('authenticated');
            } else {
                setUser(null);
                setStatus('anonymous');
            }
        } catch {
            setUser(null);
            setBanned(false);
            setStatus('anonymous');
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const logout = useCallback(async () => {
        window.location.href = '/auth/logout';
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ status, user, banned, refresh, logout }),
        [status, user, banned, refresh, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
