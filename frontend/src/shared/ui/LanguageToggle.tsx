import type { Lang } from '../lib/useLang';
import baseStyles from './ThemeToggle.module.css';

interface LanguageToggleProps {
    lang: Lang;
    onToggle: () => void;
    className?: string;
}

// Та же базовая кнопка-кружок, что ThemeToggle (общий .toggle из
// ThemeToggle.module.css) — просто с текстовой меткой языка вместо иконки.
export function LanguageToggle({ lang, onToggle, className }: LanguageToggleProps) {
    const next = lang === 'ru' ? 'EN' : 'RU';
    return (
        <button
            type="button"
            className={className ? `${baseStyles.toggle} ${className}` : baseStyles.toggle}
            onClick={onToggle}
            title={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            aria-label={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
        >
            <span style={{ fontSize: 11, fontWeight: 700 }}>{next}</span>
        </button>
    );
}
