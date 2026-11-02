import type { TextareaHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
}

export function TextArea({ label, id, style, ...rest }: TextAreaProps) {
    return (
        <label className={styles.field} htmlFor={id}>
            <span className={styles.label}>{label}</span>
            <textarea
                id={id}
                className={styles.textarea}
                {...rest}
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
                    ...style, // если передали style снаружи — он перебьёт дефолт
                }}
            />
        </label>
    );
}
