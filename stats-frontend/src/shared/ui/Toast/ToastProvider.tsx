import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconX } from '../Icons';
import { ToastContext, type ToastVariant } from './ToastContext';
import styles from './index.module.scss';

interface ToastItem {
    id: number;
    message: string;
    variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4000;

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts(current => current.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, variant: ToastVariant = 'success') => {
            const id = nextId.current++;
            setToasts(current => [...current, { id, message, variant }]);
            window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
        },
        [dismiss]
    );

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className={styles.viewport} role="region" aria-label="Notifications">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`${styles.toast} ${styles[toast.variant]}`}
                        role="status"
                        aria-live="polite"
                    >
                        <span className={styles.icon} aria-hidden="true">
                            {toast.variant === 'success' ? <IconCheck /> : <IconX />}
                        </span>
                        <span className={styles.message}>{toast.message}</span>
                        <button
                            type="button"
                            className={styles.dismiss}
                            onClick={() => dismiss(toast.id)}
                            aria-label="Dismiss notification"
                        >
                            <IconX />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
