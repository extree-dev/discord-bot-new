import type { ManagedGuild } from '../../entities/guild/types';
import styles from './GuildList.module.css';

interface GuildListProps {
    guilds: ManagedGuild[];
}

export function GuildList({ guilds }: GuildListProps) {
    if (guilds.length === 0) {
        return <p className={styles.empty}>Пока ни одного сервера, где ты администратор и уже добавлен Extree.</p>;
    }

    return (
        <ul className={styles.list}>
            {guilds.map(guild => (
                <li className={styles.item} key={guild.id}>
                    {guild.iconUrl ? (
                        <img className={styles.icon} src={guild.iconUrl} alt="" width={40} height={40} />
                    ) : (
                        <span className={styles.iconPlaceholder}>{guild.name.slice(0, 1)}</span>
                    )}
                    <span>{guild.name}</span>
                </li>
            ))}
        </ul>
    );
}
