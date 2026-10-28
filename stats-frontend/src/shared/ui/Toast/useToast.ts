import { useContext } from 'react';
import { ToastContext } from './ToastContext';

// Тот же паттерн, что useAuth/AuthContext: отдельный файл для хука, чтобы
// Fast Refresh не ругался на файл, экспортирующий и компонент, и хук.
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within <ToastProvider>');
    }
    return ctx;
}
