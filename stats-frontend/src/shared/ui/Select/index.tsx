import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import styles from './index.module.scss';

interface Option {
    value: string;
    label: string;
}

interface SelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function Select({ options, value, onChange, placeholder = 'Select...' }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    // Закрываем при клике вне компонента
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <div
                className={`${styles.trigger} ${isOpen ? styles.active : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span>{selectedOption ? selectedOption.label : placeholder}</span>
                <svg
                    className={`${styles.icon} ${isOpen ? styles.open : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {isOpen && (
                <div className={styles.menu} role="listbox">
                    {options.map(option => (
                        <div
                            key={option.value}
                            className={`${styles.option} ${option.value === value ? styles.selected : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            role="option"
                            aria-selected={option.value === value}
                        >
                            {option.label}
                            {option.value === value && (
                                <svg
                                    className={styles.check}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
