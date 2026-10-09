import { useEffect, useState } from 'react';
import { getBotInfo } from '../../entities/bot-info/api';
import styles from './BrandMark.module.css';

interface BrandMarkProps {
    className?: string;
}

// Бренд-плашка "Extree" — раньше везде захардкоженная буква "E" в
// цветном квадрате (см. GET /api/bot-info в dashboard/server.js),
// теперь настоящая аватарка бота из Discord, с тем же буквенным
// фолбэком, если у бота нет аватара, запрос не успел загрузиться или
// сама картинка не загрузилась (onError) — никогда не показываем
// битую картинку. className передаёт конкретный слот вызова
// (styles.badge/.deniedBadge из AdminShell/AuthSplitScreen) — этот
// компонент только кладёт <img> поверх уже готового квадрата той
// разметки, не трогая его размер/фон/радиус.
export function BrandMark({ className }: BrandMarkProps) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getBotInfo()
            .then(info => {
                if (!cancelled) setAvatarUrl(info.avatarUrl);
            })
            .catch(() => {
                // avatarUrl остаётся null — ниже это уже буквенный
                // фолбэк, как и раньше до этого компонента.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (avatarUrl && !imageFailed) {
        return (
            <span className={className}>
                <img src={avatarUrl} alt="" className={styles.image} onError={() => setImageFailed(true)} />
            </span>
        );
    }

    return <span className={className}>E</span>;
}
