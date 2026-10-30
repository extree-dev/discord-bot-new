import { useState, useEffect, type InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

const GENERATE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
const GENERATE_LENGTH = 14;

function generatePassword(): string {
    const bytes = new Uint32Array(GENERATE_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => GENERATE_CHARS[byte % GENERATE_CHARS.length]).join('');
}

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
    label: string;
    value: string;
    onChange: (value: string) => void;
    showGenerate?: boolean;
}

export function PasswordField({ label, id, value, onChange, showGenerate, ...rest }: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (!animate) return;
        const t = setTimeout(() => setAnimate(false), 350);
        return () => clearTimeout(t);
    }, [animate]);

    function handleToggle() {
        setVisible(v => !v);
        setAnimate(true);
    }

    function handleGenerate() {
        onChange(generatePassword());
        setVisible(true);
        setAnimate(true);
    }

    return (
        <div className={styles.field}>
            <div className={styles.inputWrap}>
                <input
                    id={id}
                    placeholder=" "
                    className={`${styles.input} ${styles.hasIcon}`}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    {...rest}
                />
                <span className={styles.icon}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </span>
                <label className={styles.label} htmlFor={id}>
                    {label}
                </label>
                <button
                    type="button"
                    className={`${styles.toggle} ${animate ? styles.togglePulse : ''}`}
                    onClick={handleToggle}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                >
                    {visible ? (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    ) : (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    )}
                </button>
            </div>
            {showGenerate && (
                <button type="button" className={styles.generate} onClick={handleGenerate}>
                    Generate password
                </button>
            )}
        </div>
    );
}
