import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Avatar } from '../../shared/ui/Avatar';
import { IconButton } from '../../shared/ui/IconButton';
import { IconCheck, IconX, ShieldIcon, IconShieldOff } from '../../shared/ui/Icons';
import {
    getAccount,
    getAllUsers,
    banUser,
    verifyUser,
    makeAdmin,
    ApiError,
    type AccountUser,
    type AdminUser,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function AdminUsersPage() {
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);

    function loadUsers() {
        getAllUsers()
            .then(res => setUsers(res.users))
            .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load users'))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        getAccount().then(u => {
            if (!u || !u.isAdmin) navigate('/login');
            else {
                setAccount(u);
                loadUsers();
            }
        });
    }, [navigate]);

    async function handleAction(id: string, action: () => Promise<any>, field: keyof AdminUser) {
        setPendingId(id);
        try {
            await action();
            setUsers(users.map(u => (u.id === id ? { ...u, [field]: !u[field] } : u)));
        } catch (e) {
            alert(`Failed to update ${field}`);
        } finally {
            setPendingId(null);
        }
    }

    if (loading) {
        return (
            <DashboardShell user={null} title="Loading...">
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)' }}>Loading...</div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell user={account!} title="User Management" wide>
            {error && <div className={styles.errorBanner}>{error}</div>}
            
            <Panel noBodyPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>User</th>
                                <th style={{ width: '15%' }}>Status</th>
                                <th style={{ width: '15%' }}>Role</th>
                                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className={u.isBanned ? styles.bannedRow : ''}>
                                    <td>
                                        <div className={styles.userCell}>
                                            <Avatar label={u.nickname || u.name || u.email} />
                                            <div>
                                                <div className={styles.userName}>
                                                    {u.nickname || u.name || 'Unknown'}
                                                    {u.isVerified && (
                                                        <span className={styles.blueTick} title="Verified">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.userEmail}>{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${u.isBanned ? styles.statusBanned : styles.statusActive}`}>
                                            <span className={styles.dot} />
                                            {u.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        {u.isAdmin ? (
                                            <span className={styles.adminBadge}>
                                                <ShieldIcon /> Admin
                                            </span>
                                        ) : (
                                            <span className={styles.roleUser}>User</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <IconButton 
                                                variant={u.isVerified ? 'active' : 'default'}
                                                onClick={() => handleAction(u.id, () => verifyUser(u.id, !u.isVerified), 'isVerified')}
                                                disabled={pendingId === u.id}
                                                title={u.isVerified ? "Remove Verification" : "Verify User"}
                                            >
                                                {u.isVerified ? <IconX /> : <IconCheck />}
                                            </IconButton>
                                            
                                            <IconButton 
                                                variant={u.isAdmin ? 'active' : 'default'}
                                                onClick={() => handleAction(u.id, () => makeAdmin(u.id, !u.isAdmin), 'isAdmin')}
                                                disabled={pendingId === u.id}
                                                title={u.isAdmin ? "Remove Admin" : "Make Admin"}
                                            >
                                                {u.isAdmin ? <IconShieldOff /> : <ShieldIcon />}
                                            </IconButton>
                                            
                                            <IconButton 
                                                variant={u.isBanned ? 'default' : 'danger'}
                                                onClick={() => handleAction(u.id, () => banUser(u.id, !u.isBanned), 'isBanned')}
                                                disabled={pendingId === u.id}
                                                title={u.isBanned ? "Unban User" : "Ban User"}
                                            >
                                                {u.isBanned ? <IconCheck /> : <IconX />}
                                            </IconButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </DashboardShell>
    );
}