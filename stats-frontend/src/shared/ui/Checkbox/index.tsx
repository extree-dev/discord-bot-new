import type { InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: string;
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
    return (
        <label className={`${styles.label} ${className ?? ''}`} htmlFor={id}>
            <div className={styles.checkboxWrap}>
                <input id={id} type="checkbox" className={styles.input} {...rest} />
                <span className={styles.checkmark}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
            </div>
            <span className={styles.text}>{label}</span>
        </label>
    );
}
