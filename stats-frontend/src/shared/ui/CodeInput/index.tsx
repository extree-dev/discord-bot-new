import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import styles from './index.module.scss';

interface CodeInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
    disabled?: boolean;
}

// Отдельные ячейки на цифру вместо одного текстового поля — перенесено из
// макетов письма с кодом (email-N), где именно этот вид кода "зашёл"
// пользователю; с анимацией попапа при заполнении ячейки (см. .pop в
// index.module.scss) вместо просто мигающего курсора в одной строке.
export function CodeInput({ length = 6, value, onChange, autoFocus, disabled }: CodeInputProps) {
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
    const [poppedIndex, setPoppedIndex] = useState<number | null>(null);

    const digits = Array.from({ length }, (_, i) => value[i] ?? '');

    function commit(nextDigits: string[]) {
        onChange(nextDigits.join('').slice(0, length));
    }

    function handleChange(index: number, raw: string) {
        const digit = raw.replace(/\D/g, '').slice(-1);
        const next = digits.slice();
        next[index] = digit;
        commit(next);
        if (digit) {
            setPoppedIndex(index);
            inputsRef.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            const next = digits.slice();
            next[index - 1] = '';
            commit(next);
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        if (!pasted) return;
        e.preventDefault();
        onChange(pasted);
        setPoppedIndex(pasted.length - 1);
        inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
    }

    return (
        <div className={styles.row}>
            {digits.map((digit, i) => (
                <input
                    key={i}
                    ref={el => {
                        inputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    autoFocus={autoFocus && i === 0}
                    className={`${styles.box} ${digit ? styles.filled : ''} ${poppedIndex === i ? styles.pop : ''}`}
                    onAnimationEnd={() => setPoppedIndex(current => (current === i ? null : current))}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    aria-label={`Digit ${i + 1} of ${length}`}
                />
            ))}
        </div>
    );
}
