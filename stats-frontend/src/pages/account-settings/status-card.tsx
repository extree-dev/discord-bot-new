import { Panel } from '../../shared/ui/Panel';
import { IconCheck, IconX } from '../../shared/ui/Icons';
import type { AccountUser } from '../../shared/api/statsAuth';
import styles from './status-card.module.scss';

export function AccountStatusCard({ user }: { user: AccountUser }) {
    return (
        <Panel title="Account status">
            <div className={styles.statusList}>
                <div className={styles.statusRow}>
                    <span className={styles.label}>Role</span>
                    <span className={user.isAdmin ? styles.pillAdmin : styles.pillNeutral}>
                        {user.isAdmin ? 'Admin' : 'Standard'}
                    </span>
                </div>
                <div className={styles.statusRow}>
                    <span className={styles.label}>Email</span>
                    <span className={user.emailVerified ? styles.pillGood : styles.pillWarn}>
                        {user.emailVerified ? (
                            <>
                                <IconCheck /> Verified
                            </>
                        ) : (
                            <>
                                <IconX /> Unverified
                            </>
                        )}
                    </span>
                </div>
                <div className={styles.statusRow}>
                    <span className={styles.label}>Riot account</span>
                    <span className={user.riotLinked ? styles.pillGood : styles.pillNeutral}>
                        {user.riotLinked ? 'Linked' : 'Not linked'}
                    </span>
                </div>
                <div className={styles.statusRow}>
                    <span className={styles.label}>2FA</span>
                    <span className={user.isTwoFactorEnabled ? styles.pillGood : styles.pillNeutral}>
                        {user.isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
        </Panel>
    );
}
