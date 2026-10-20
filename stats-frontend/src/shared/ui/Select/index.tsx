import type { SelectHTMLAttributes } from 'react';
import styles from './index.module.scss';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: SelectOption[];
}

// TextField, но для <select> (pages/support, категория обращения) — тот же
// визуальный язык (uppercase-лейбл, border-radius 4px).
export function Select({ label, id, options, ...rest }: SelectProps) {
    return (
        <label className={styles.field} htmlFor={id}>
            <span className={styles.label}>{label}</span>
            <select id={id} className={styles.select} {...rest}>
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
