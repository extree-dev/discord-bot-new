import styles from './StatPair.module.css';

interface StatPairProps {
    online: number;
    members: number;
}

function format(n: number): string {
    return n.toLocaleString('en-US');
}

export function StatPair({ online, members }: StatPairProps) {
    return (
        <div className={styles.stats}>
            <div className={styles.stat}>
                <span className={styles.value}>{format(online)}</span>
                <span className={styles.label}>Online</span>
            </div>
            <div className={styles.stat}>
                <span className={styles.value}>{format(members)}</span>
                <span className={styles.label}>Members</span>
            </div>
        </div>
    );
}
