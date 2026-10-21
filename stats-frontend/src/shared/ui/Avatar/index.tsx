import styles from './index.module.scss';

function initialsFrom(label: string): string {
    const name = label.split('@')[0];
    return name.slice(0, 2).toUpperCase();
}

// Инициалы вместо настоящих аватарок — у аккаунтов Extree Stats нет
// загружаемой фотографии профиля, а пустой кружок-заглушка выглядит
// дешевле, чем пара букв на фирменном фоне (тот же приём, что Linear/
// GitHub используют для аккаунтов без аватара).
export function Avatar({ label, isSupport = false }: { label: string; isSupport?: boolean }) {
    return (
        <span className={`${styles.avatar} ${isSupport ? styles.support : ''}`} aria-hidden="true">
            {isSupport ? 'EX' : initialsFrom(label)}
        </span>
    );
}
