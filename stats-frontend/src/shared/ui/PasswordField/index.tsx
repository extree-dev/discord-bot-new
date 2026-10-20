import { useState, type InputHTMLAttributes } from 'react';
import styles from './index.module.scss';

const GENERATE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
const GENERATE_LENGTH = 14;

// crypto.getRandomValues, а не Math.random — то же требование к
// случайности, что и для токена сброса пароля на бэкенде (passwordResets.js),
// просто на стороне клиента для кнопки "Generate".
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

// TextField, но для пароля: кнопка-глаз показывает/скрывает введённый
// текст, а необязательная кнопка "Generate" (shared/ui/PasswordField только
// для pages/reset-password, см. обсуждение) сразу подставляет сгенерированный
// пароль и открывает видимость, чтобы его было видно, а не только "готово".
export function PasswordField({ label, id, value, onChange, showGenerate, ...rest }: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);

    function handleGenerate() {
        onChange(generatePassword());
        setVisible(true);
    }

    return (
        <div className={styles.field}>
            <div className={styles.labelRow}>
                <label className={styles.label} htmlFor={id}>
                    {label}
                </label>
                {showGenerate && (
                    <button type="button" className={styles.generate} onClick={handleGenerate}>
                        Generate
                    </button>
                )}
            </div>
            <div className={styles.inputRow}>
                <input
                    id={id}
                    className={styles.input}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    {...rest}
                />
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setVisible(v => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                >
                    {visible ? 'Hide' : 'Show'}
                </button>
            </div>
        </div>
    );
}
