import type { TextareaHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
}

// TextField, но для многострочного текста (pages/support) — тот же
// визуальный язык (uppercase-лейбл, border-radius 4px), просто textarea
// вместо input.
export function TextArea({ label, id, ...rest }: TextAreaProps) {
    return (
        <label className={styles.field} htmlFor={id}>
            <span className={styles.label}>{label}</span>
            <textarea id={id} className={styles.textarea} {...rest} />
        </label>
    );
}
