import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './index.module.scss';

interface SearchBarProps {
    // Если задан — поиск идёт сразу в профиль этой игры.
    // Если нет — пользователь после ввода выбирает игру на странице /search.
    gameSlug?: string;
    placeholder?: string;
    defaultValue?: string;
}

// Публичный поиск игрока. Работает без логина. Ключевая точка входа
// на витрину (как на Tracker.gg): вбил ник → увидел статы.
//
// Формат ввода — 'Name#TAG' (Riot ID) для VALORANT, либо просто 'nickname'
// для других игр. Здесь мы не валидируем формат — это дело конкретного
// адаптера игры (см. shared/config/games.ts).
export function SearchBar({ gameSlug, placeholder, defaultValue = '' }: SearchBarProps) {
    const navigate = useNavigate();
    const [value, setValue] = useState(defaultValue);

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;

        if (gameSlug) {
            // Прямой переход в профиль игры
            navigate(`/player/${gameSlug}/${encodeURIComponent(q)}`);
        } else {
            // Без игры — на страницу выбора (или на /valorant по умолчанию,
            // пока реально работает только он)
            navigate(`/player/valorant/${encodeURIComponent(q)}`);
        }
    }

    return (
        <form className={styles.wrapper} onSubmit={onSubmit} role="search">
            <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
                type="search"
                className={styles.input}
                placeholder={placeholder ?? 'Search player — Name#TAG'}
                value={value}
                onChange={e => setValue(e.target.value)}
                aria-label="Search player"
            />
            {!gameSlug && <span className={styles.gameHint}>VAL</span>}
        </form>
    );
}
