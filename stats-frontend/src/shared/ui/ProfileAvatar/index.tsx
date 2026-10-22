import { useRef, useState } from 'react';
import { uploadAvatar } from '../../../shared/api/statsAuth';
import styles from './index.module.scss';

interface ProfileAvatarProps {
    currentUrl: string | null;
    email: string;
    onUploaded: (url: string) => void;
}

export function ProfileAvatar({ currentUrl, email, onUploaded }: ProfileAvatarProps) {
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('Файл слишком большой (макс. 2MB)');
            return;
        }

        setLoading(true);
        try {
            const { avatarUrl } = await uploadAvatar(file);
            onUploaded(avatarUrl);
        } catch (err) {
            alert('Не удалось загрузить аватар');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.avatarWrapper}>
                {currentUrl ? (
                    <img src={currentUrl} alt="Avatar" className={styles.image} />
                ) : (
                    <div className={styles.placeholder}>{email[0].toUpperCase()}</div>
                )}
                <div className={styles.overlay} onClick={() => fileInputRef.current?.click()}>
                    {loading ? 'Загрузка...' : 'Изменить'}
                </div>
            </div>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}
