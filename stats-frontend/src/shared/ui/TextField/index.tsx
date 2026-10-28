import type { InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    // Красная рамка для real-time валидации (напр. невалидный формат email
    // или ответ сервера "уже занято") — не завязана на сообщение об ошибке,
    // текст самой ошибки показывается отдельно (баннер/toast) вызывающим
    // кодом.
    error?: boolean;
}

export function TextField({ label, id, error, className, ...rest }: TextFieldProps) {
    return (
        <label className={styles.field} htmlFor={id}>
            <span className={styles.label}>{label}</span>
            <input
                id={id}
                className={`${styles.input} ${error ? styles.inputError : ''} ${className ?? ''}`}
                aria-invalid={error || undefined}
                {...rest}
            />
        </label>
    );
}
