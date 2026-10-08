import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from './icons';
import styles from './Select.module.css';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    id?: string;
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

// Кастомный выпадающий список вместо браузерного <select> — на референсах
// пользователь прямо указал заменить нативный попап (разный на каждой ОС,
// не стилизуется) на свою панель с Apple Liquid Glass (реальный blur, см.
// .panel в Select.module.css). Семантика выбора — не полноценный ARIA
// combobox со стрелками (это SPA с небольшими списками, не форма с сотнями
// опций), просто кнопка + список кнопок, закрывается по Escape/клику снаружи.
export function Select({ id, value, options, onChange, placeholder, disabled, className, ariaLabel }: SelectProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const current = options.find(o => o.value === value);

    return (
        <div className={className ? `${styles.root} ${className}` : styles.root} ref={rootRef}>
            <button
                type="button"
                id={id}
                className={styles.trigger}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                onClick={() => setOpen(o => !o)}
            >
                <span className={styles.triggerLabel}>{current ? current.label : (placeholder ?? '')}</span>
                <span className={styles.chevron} data-open={open}>
                    <ChevronDownIcon />
                </span>
            </button>
            {open && (
                <ul className={styles.panel} role="listbox">
                    {options.map(opt => (
                        <li key={opt.value}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={opt.value === value}
                                className={
                                    opt.value === value ? `${styles.option} ${styles.optionActive}` : styles.option
                                }
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                {opt.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
