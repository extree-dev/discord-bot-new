import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './index.module.scss';

interface SmartSearchBarProps {
    gameSlug: string;
    placeholder?: string;
}

// Используем точные имена ваших скачанных иконок
const SEARCH_CONFIG: Record<
    string,
    {
        placeholder: string;
        icon: string;
        platforms?: { id: string; label: string; icon: string }[];
    }
> = {
    valorant: { placeholder: 'Enter Riot ID (Name#TAG)', icon: '/icons/icons8-riot-games-50.png' },
    lol: { placeholder: 'Enter Riot ID (Name#TAG)', icon: '/icons/icons8-riot-games-50.png' },
    cs2: { placeholder: 'Enter Steam ID, URL, or Vanity', icon: '/icons/icons8-steam-50.png' },
    dota2: { placeholder: 'Enter Steam ID, URL, or Vanity', icon: '/icons/icons8-steam-50.png' },
    apex: { placeholder: 'Enter Origin ID', icon: '/icons/electronics-arts.png' },
    fortnite: { placeholder: 'Enter Epic Games Display Name', icon: '/icons/icons8-epic-games-50.png' },
    cod: {
        placeholder: 'Enter Activision ID',
        // Для Activision используем иконку Xbox как заглушку (вы можете позже заменить на свою)
        icon: '/icons/icons8-xbox-30.png',
        platforms: [
            { id: 'bnet', label: 'Battle.net', icon: '/icons/icons8-battle-net-50.png' },
            { id: 'psn', label: 'PlayStation', icon: '/icons/icons8-play-station-30.png' },
            { id: 'xbox', label: 'Xbox', icon: '/icons/icons8-xbox-30.png' },
        ],
    },
};

export function SmartSearchBar({ gameSlug }: SmartSearchBarProps) {
    const navigate = useNavigate();
    const [value, setValue] = useState('');
    const [platform, setPlatform] = useState('bnet');
    const config = SEARCH_CONFIG[gameSlug] || SEARCH_CONFIG['valorant'];

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        navigate(`/player/${gameSlug}/${encodeURIComponent(q)}`);
    }

    return (
        <form className={styles.wrapper} onSubmit={onSubmit}>
            <div className={styles.searchBox}>
                {config.platforms && (
                    <div className={styles.platforms}>
                        {config.platforms.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                className={`${styles.platformBtn} ${platform === p.id ? styles.platformActive : ''}`}
                                onClick={() => setPlatform(p.id)}
                                title={p.label}
                            >
                                <img
                                    src={p.icon}
                                    alt={p.label}
                                    width="16"
                                    height="16"
                                    style={{ opacity: platform === p.id ? 1 : 0.5 }}
                                />
                            </button>
                        ))}
                        <div className={styles.dividerLine} />
                    </div>
                )}
                {!config.platforms && (
                    <div className={styles.gameIcon}>
                        <img src={config.icon} alt="game icon" width="20" height="20" />
                    </div>
                )}
                <input
                    type="search"
                    className={styles.input}
                    placeholder={config.placeholder}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                />
            </div>
        </form>
    );
}
