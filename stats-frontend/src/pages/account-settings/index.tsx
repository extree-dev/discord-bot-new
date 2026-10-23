import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { ProfileAvatar } from '../../shared/ui/ProfileAvatar'; // <-- Импорт
import { getAccount, type AccountUser } from '../../shared/api/statsAuth';
import { UpdateEmail } from '../../features/update-email';
import { UpdatePassword } from '../../features/update-password';
import { ActiveSessions } from '../../features/active-sessions';
import { Select } from '../../shared/ui/Select';
import styles from './index.module.scss';
import { VerifiedBadge } from '../../shared/ui/VerifiedBadge';

export function AccountSettingsPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<AccountUser | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

    const [banned, setBanned] = useState(false);

    useEffect(() => {
        getAccount().then(result => {
            if (result.banned) {
                setBanned(true);
            } else if (!result.user) {
                navigate('/login');
            } else {
                setUser(result.user);
            }
        });
    }, [navigate]);

    if (banned) {
        return (
            <DashboardShell user={null} title="Account banned">
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2>Your account has been banned.</h2>
                    <p>
                        Please contact <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </div>
            </DashboardShell>
        );
    }

    if (!user)
        return (
            <DashboardShell user={null} title="Loading...">
                Loading...
            </DashboardShell>
        );

    return (
        <DashboardShell user={{ email: user.email, isAdmin: user.isAdmin }} title="" wide>
            <div className={styles.pageLayout}>
                <aside className={styles.sidebar}>
                    <Link to="/account" className={styles.backBtn}>
                        ← Back to Dashboard
                    </Link>
                    <h1 className={styles.title}>Settings</h1>
                    <nav className={styles.navMenu}>
                        <button
                            className={`${styles.navItem} ${activeTab === 'profile' ? styles.active : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            Profile Information
                        </button>
                        <button
                            className={`${styles.navItem} ${activeTab === 'security' ? styles.active : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            Login & Security
                        </button>
                    </nav>
                </aside>

                <main className={styles.content}>
                    {activeTab === 'profile' && (
                        <div className={styles.tabContent}>
                            <Panel title="Personal Information">
                                <div className={styles.avatarSection}>
                                    {/* Внедряем компонент аватарки */}
                                    <ProfileAvatar
                                        currentUrl={user.avatarUrl}
                                        email={user.email}
                                        onUploaded={url => setUser(u => u && { ...u, avatarUrl: url })}
                                    />
                                    <div className={styles.avatarInfo}>
                                        <p className={styles.hintText}>JPG, PNG or GIF. Max 2MB.</p>
                                    </div>
                                </div>

                                <div className={styles.divider} />

                                <div className={styles.infoList}>
                                    <div className={styles.row}>
                                        <span className={styles.label}>Name</span>
                                        <div className={styles.value} style={{ display: 'flex', alignItems: 'center' }}>
                                            {user.name || '—'}
                                            {user.isVerified && <VerifiedBadge />}
                                        </div>
                                    </div>
                                    <div className={styles.row}>
                                        <span className={styles.label}>Nickname</span>
                                        <div className={styles.value} style={{ display: 'flex', alignItems: 'center' }}>
                                            {user.nickname || '—'}
                                            {user.isVerified && <VerifiedBadge />}
                                        </div>
                                    </div>
                                    <div className={styles.row}>
                                        <span className={styles.label}>Email</span>
                                        <div className={styles.emailRow}>
                                            <span className={styles.value}>{user.email}</span>
                                            {user.emailVerified ? (
                                                <span className={styles.badgeSuccess}>Verified</span>
                                            ) : (
                                                <span className={styles.badgeWarning}>Unverified</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.row}>
                                        <span className={styles.label}>Language</span>
                                        <div style={{ width: '180px' }}>
                                            <Select
                                                options={[
                                                    { value: 'en', label: 'English (US)' },
                                                    { value: 'ru', label: 'Русский' },
                                                ]}
                                                value="en"
                                                onChange={val => console.log('Язык изменен на', val)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                            <UpdateEmail
                                email={user.email}
                                onChanged={newEmail => setUser(u => u && { ...u, email: newEmail })}
                            />
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className={styles.tabContent}>
                            <UpdatePassword />
                            <ActiveSessions />
                            <Panel title="Danger Zone">
                                <div className={styles.dangerRow}>
                                    <div>
                                        <h4>Delete Account</h4>
                                        <p className={styles.hintText}>Once deleted, there is no going back.</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        disabled
                                        style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                                    >
                                        Delete Account
                                    </Button>
                                </div>
                            </Panel>
                        </div>
                    )}
                </main>
            </div>
        </DashboardShell>
    );
}
