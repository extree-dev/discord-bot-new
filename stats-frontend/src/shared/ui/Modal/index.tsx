import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import styles from './index.module.scss';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    labelledBy?: string;
    size?: 'md' | 'lg';
    children: ReactNode;
}

// Нативный <dialog> вместо руками написанного focus-trap: showModal() сам
// триммит фокус внутрь, ставит остальную страницу inert и закрывается по
// Escape — браузер делает за нас то, что обычно пишут вручную в компоненте
// "Modal". Мы только синхронизируем open/close с React-состоянием и красим
// поверх дефолтных UA-стилей.
export function Modal({ open, onClose, title, labelledBy, size = 'md', children }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        // Покрывает и клик по backdrop (браузер сам закрывает dialog через
        // form[method=dialog] не используется здесь), и Escape — оба пути
        // в итоге бросают нативное событие 'close', на которое достаточно
        // подписаться один раз, вместо отдельного onCancel.
        function handleClose() {
            onClose();
        }
        dialog.addEventListener('close', handleClose);
        return () => dialog.removeEventListener('close', handleClose);
    }, [onClose]);

    function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
        if (!inside) dialog.close();
    }

    return (
        <dialog
            ref={dialogRef}
            className={`${styles.dialog} ${styles[size]}`}
            aria-labelledby={labelledBy}
            onClick={handleBackdropClick}
        >
            {open && (
                <div className={styles.content}>
                    {title && (
                        <h2 className={styles.title} id={labelledBy}>
                            {title}
                        </h2>
                    )}
                    {children}
                </div>
            )}
        </dialog>
    );
}
