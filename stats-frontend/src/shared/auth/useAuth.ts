import { useContext } from 'react';
import { AuthContext } from './AuthContext';

// SRP: только чтение контекста. Сам контекст и провайдер — в AuthContext /
// AuthProvider. Хук отдельный файл, чтобы Fast Refresh (react-refresh) не
// ругался на "файл экспортирует и компонент, и хук".
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within <AuthProvider>');
    }
    return ctx;
}
