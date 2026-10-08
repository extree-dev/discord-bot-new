import type { Theme } from '../lib/useTheme';
import { MoonIcon, SunIcon } from './icons';
import baseStyles from './ThemeToggle.module.css';

interface ThemeToggleProps {
    theme: Theme;
    onToggle: () => void;
    className?: string;
}

// Базовые стили сбрасывают кнопку до круга нужного размера — цвет/фон
// (как кнопка выглядит на конкретном фоне — тёмный сайдбар, светлый
// экран входа и т.п.) задаёт className конкретного места использования.
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
    return (
        <button
            type="button"
            className={className ? `${baseStyles.toggle} ${className}` : baseStyles.toggle}
            onClick={onToggle}
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            aria-label={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
        >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
    );
}
