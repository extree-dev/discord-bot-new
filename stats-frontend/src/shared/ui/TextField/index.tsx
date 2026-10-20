import type { InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export function TextField({ label, id, ...rest }: TextFieldProps) {
    return (
        <label className={styles.field} htmlFor={id}>
            <span className={styles.label}>{label}</span>
            <input id={id} className={styles.input} {...rest} />
        </label>
    );
}
