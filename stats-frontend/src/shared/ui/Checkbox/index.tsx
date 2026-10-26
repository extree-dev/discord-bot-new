import type { InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: string;
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
    return (
        <label className={`${styles.label} ${className ?? ''}`} htmlFor={id}>
            <input id={id} type="checkbox" className={styles.input} {...rest} />
            {label}
        </label>
    );
}
