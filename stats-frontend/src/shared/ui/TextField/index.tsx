import { useState, useEffect, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './index.module.scss';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: boolean;
    icon?: ReactNode;
}

export function TextField({ label, id, error, icon, className, type, ...rest }: TextFieldProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [animate, setAnimate] = useState(false);
    const isPassword = type === 'password';
    const actualType = isPassword && showPassword ? 'text' : type;

    // Сбрасываем класс анимации после её окончания
    useEffect(() => {
        if (!animate) return;
        const t = setTimeout(() => setAnimate(false), 350);
        return () => clearTimeout(t);
    }, [animate]);

    function handleToggle() {
        setShowPassword(v => !v);
        setAnimate(true);
    }

    return (
        <div className={`${styles.field} ${error ? styles.hasError : ''}`}>
            <div className={styles.inputWrap}>
                <input
                    id={id}
                    placeholder=" "
                    type={actualType}
                    className={`${styles.input} ${icon ? styles.hasIcon : ''} ${isPassword ? styles.hasToggle : ''} ${className ?? ''}`}
                    aria-invalid={error || undefined}
                    {...rest}
                />
                {icon && <span className={styles.icon}>{icon}</span>}
                <label className={styles.label} htmlFor={id}>
                    {label}
                </label>
                {isPassword && (
                    <button
                        type="button"
                        className={`${styles.toggle} ${animate ? styles.togglePulse : ''}`}
                        onClick={handleToggle}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                    >
                        {showPassword ? (
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
                )}
            </div>
        </div>
    );
}
