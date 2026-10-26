import type { InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; id: string };

export function Checkbox({ label, id, ...rest }: CheckboxProps) {
    return (
        <label className={styles.row} htmlFor={id}>
            <input type="checkbox" id={id} {...rest} />
            <span>{label}</span>
        </label>
    );
}
