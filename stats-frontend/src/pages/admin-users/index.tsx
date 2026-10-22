import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { Avatar } from '../../shared/ui/Avatar';
import {
    getAccount,
    getAllUsers,
    banUser,
    verifyUser,
    makeAdmin, // <-- Импорт
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

    async function handleBan(id: string, currentStatus: boolean) {
        try {
            await banUser(id, !currentStatus);
            setUsers(users.map(u => (u.id === id ? { ...u, isBanned: !currentStatus } : u)));
        } catch (e) {
            alert('Failed to ban user');
        }
    }

    async function handleVerify(id: string, currentStatus: boolean) {
        try {
            await verifyUser(id, !currentStatus);
            setUsers(users.map(u => (u.id === id ? { ...u, isVerified: !currentStatus } : u)));
        } catch (e) {
            alert('Failed to verify user');
        }
    }

    async function handleMakeAdmin(id: string, currentStatus: boolean) {
        try {
            await makeAdmin(id, !currentStatus);
            setUsers(users.map(u => (u.id === id ? { ...u, isAdmin: !currentStatus } : u)));
        } catch (e) {
            alert('Failed to change admin status');
        }
    }

    if (loading) {
        return (
            <DashboardShell user={null} title="Loading...">
                Loading...
            </DashboardShell>
        );
    }

    return (
        <DashboardShell user={account!} title="User Management" wide>
            <Panel>
                {error && <p style={{ color: 'var(--accent)' }}>{error}</p>}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Status</th>
                                <th>Role</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className={u.isBanned ? styles.bannedRow : ''}>
                                    <td>
                                        <div className={styles.userCell}>
                                            <Avatar label={u.name || u.email} />
                                            <div>
                                                <div className={styles.userName}>
                                                    {u.nickname || u.name || 'Unknown'}
                                                    {u.isVerified && <span className={styles.blueTick}>✓</span>}
                                                </div>
                                                <div className={styles.userEmail}>{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span
                                            className={`${styles.statusBadge} ${u.isBanned ? styles.statusBanned : styles.statusActive}`}
                                        >
                                            {u.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td>{u.isAdmin ? <span className={styles.adminBadge}>Admin</span> : 'User'}</td>
                                    <td>
                                        <div className={styles.actions}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleVerify(u.id, u.isVerified)}
                                            >
                                                {u.isVerified ? 'Unverify' : 'Verify'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMakeAdmin(u.id, u.isAdmin)}
                                            >
                                                {u.isAdmin ? 'Demote' : 'Make Admin'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleBan(u.id, u.isBanned)}
                                                style={{ color: u.isBanned ? 'var(--win)' : 'var(--accent)' }}
                                            >
                                                {u.isBanned ? 'Unban' : 'Ban'}
                                            </Button>
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
