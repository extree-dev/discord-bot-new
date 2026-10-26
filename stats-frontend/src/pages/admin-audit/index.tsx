import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { getAccount, getAdminAudit, type AccountUser, type AuditEntry } from '../../shared/api/statsAuth';
import { formatRelativeTime } from '../../shared/lib/formatRelativeTime';
import styles from './index.module.scss';

export function AdminAuditPage() {
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [entries, setEntries] = useState<AuditEntry[] | null>(null);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getAccount().then(({ user, banned }) => {
            if (banned || !user || !user.isAdmin) {
                navigate('/login');
                return;
            }
            setAccount(user);
        });
    }, [navigate]);

    useEffect(() => {
        if (!account) return;
        setLoading(true);
        getAdminAudit(50, offset)
            .then(res => setEntries(res.entries))
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, [account, offset]);

    const dashUser = account ? { email: account.email, isAdmin: account.isAdmin } : null;

    return (
        <DashboardShell
            user={dashUser}
            breadcrumb={{ to: '/admin/tickets', label: 'Back to tickets' }}
            title="Audit log"
            subtitle="Admin actions — bans, verifications, ticket replies."
            wide
        >
            <div className={styles.tableWrap}>
                {loading && <div className={styles.loading}>Loading…</div>}
                {!loading && entries && entries.length === 0 && <div className={styles.loading}>No entries yet.</div>}
                {!loading && entries && entries.length > 0 && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Admin</th>
                                <th>Action</th>
                                <th>Target</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.id}>
                                    <td>{formatRelativeTime(e.createdAt)}</td>
                                    <td>{e.adminEmail}</td>
                                    <td>
                                        <code>{e.action}</code>
                                    </td>
                                    <td>
                                        {e.targetType && (
                                            <span className={styles.target}>
                                                {e.targetType}:{e.targetId?.slice(0, 8)}
                                            </span>
                                        )}
                                    </td>
                                    <td>{e.ip || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className={styles.pagination}>
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
                    ← Prev
                </button>
                <span>offset {offset}</span>
                <button disabled={!entries || entries.length < 50} onClick={() => setOffset(offset + 50)}>
                    Next →
                </button>
            </div>
        </DashboardShell>
    );
}
