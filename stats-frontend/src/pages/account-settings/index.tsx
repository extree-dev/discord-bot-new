import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { ProfileAvatar } from '../../shared/ui/ProfileAvatar'; // <-- Импорт
import {
    getAccount,
    setup2fa,
    enable2fa,
    disable2fa,
    regenerateRecoveryCodes,
    type AccountUser,
} from '../../shared/api/statsAuth';
import { UpdateEmail } from '../../features/update-email';
import { UpdatePassword } from '../../features/update-password';
import { ActiveSessions } from '../../features/active-sessions';
import { SecurityScore } from '../../features/security-score';
import { LinkedAccounts } from '../../features/linked-accounts';
import { Select } from '../../shared/ui/Select';
import styles from './index.module.scss';
import { VerifiedBadge } from '../../shared/ui/VerifiedBadge';
import { TextField } from '../../shared/ui/TextField';
import { PasswordField } from '../../shared/ui/PasswordField';
import { CodeInput } from '../../shared/ui/CodeInput';
import { ShieldIcon, UserIcon } from '../../shared/ui/Icons';
import { Skeleton } from '../../shared/ui/Skeleton';
import { QRCodeSVG } from 'qrcode.react';

// Форма загрузки повторяет форму реальной страницы (строка вкладок +
// карточка профиля), а не просто текст "Loading..." — тот же приём, что
// уже применяется в admin-tickets-list/ticket-thread.
function SettingsSkeleton() {
    return (
        <div className={styles.page}>
            <Skeleton width={140} height={14} className={styles.skeletonMb16} />
            <Skeleton width={100} height={28} className={styles.skeletonMb24} />
            <div className={styles.skeletonTabRow}>
                <Skeleton width={160} height={36} radius={6} />
                <Skeleton width={160} height={36} radius={6} />
            </div>
            <div className={styles.panel}>
                <div className={styles.skeletonRow}>
                    <Skeleton width={64} height={64} radius="50%" />
                    <div className={styles.skeletonCol}>
                        <Skeleton width={160} height={20} />
                        <Skeleton width={200} height={14} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AccountSettingsPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<AccountUser | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [banned, setBanned] = useState(false);
    const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string; recoveryCodes: string[] } | null>(
        null
    );
    const [totpCode, setTotpCode] = useState('');
    const [totpPending, setTotpPending] = useState(false);
    const [totpError, setTotpError] = useState<string | null>(null);
    const [setupPassword, setSetupPassword] = useState('');
    const [setupPending, setSetupPending] = useState(false);
    const twoFaRef = useRef<HTMLDivElement>(null);

    function handleGoToTwoFa() {
        setActiveTab('security');
        requestAnimationFrame(() => twoFaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

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

    async function handleSetup2fa() {
        if (!setupPassword) return;
        setSetupPending(true);
        setTotpError(null);
        try {
            const r = await setup2fa(setupPassword);
            setTotpSetup(r);
        } catch (e) {
            setTotpError(e instanceof Error ? e.message : 'Failed to start 2FA setup');
            setSetupPassword('');
        } finally {
            setSetupPending(false);
        }
    }

    async function handleEnable2fa() {
        if (!totpCode.trim()) return;
        setTotpPending(true);
        setTotpError(null);
        try {
            // Пароль уже введён и проверен на шаге "Set up 2FA" выше — не
            // спрашиваем его второй раз.
            await enable2fa(totpCode.trim(), setupPassword);
            setTotpSetup(null);
            setTotpCode('');
            setSetupPassword('');
            // Без этого user.isTwoFactorEnabled оставался прежним (false) до
            // ручной перезагрузки страницы — тот же рефреш, что уже делает
            // handleDisable2fa ниже после отключения 2FA.
            const fresh = await getAccount();
            if (fresh.user) setUser(fresh.user);
            alert('2FA enabled. Save your recovery codes!');
        } catch (e) {
            setTotpError(e instanceof Error ? e.message : 'Failed to enable 2FA');
        } finally {
            setTotpPending(false);
        }
    }

    function handleCancelSetup() {
        setTotpSetup(null);
        setTotpCode('');
        setSetupPassword('');
        setTotpError(null);
    }

    async function handleDisable2fa() {
        const pwd = prompt('Enter your password to disable 2FA:');
        if (!pwd) return;
        try {
            await disable2fa(pwd);
            const fresh = await getAccount();
            if (fresh.user) setUser(fresh.user);
            alert('2FA disabled.');
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to disable 2FA');
        }
    }

    async function handleRegenCodes() {
        const pwd = prompt('Enter your password to regenerate recovery codes:');
        if (!pwd) return;
        try {
            const r = await regenerateRecoveryCodes(pwd);
            alert('New recovery codes (save them):\n\n' + r.recoveryCodes.join('\n'));
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to regenerate codes');
        }
    }

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
            <DashboardShell user={null} title="" wide>
                <SettingsSkeleton />
            </DashboardShell>
        );

    return (
        <DashboardShell user={{ email: user.email, isAdmin: user.isAdmin }} title="" wide>
            <div className={styles.page}>
                <Link to="/account" className={styles.backBtn}>
                    ← Back to Dashboard
                </Link>
                <h1 className={styles.title}>Settings</h1>

                {/* Горизонтальная строка вкладок вместо левого сайдбара —
                    контент теперь на всю ширину под ней, в одну колонку. */}
                <nav className={styles.tabRow}>
                    <button
                        className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <UserIcon />
                        Profile Information
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'security' ? styles.active : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <ShieldIcon />
                        Login & Security
                    </button>
                </nav>

                <main className={styles.content}>
                    {activeTab === 'profile' && (
                        <div className={styles.tabContent}>
                            <Panel title="Personal Information">
                                {isEditingProfile ? (
                                    <>
                                        {/* === РЕЖИМ РЕДАКТИРОВАНИЯ === */}
                                        <div className={styles.avatarSection}>
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
                                                <div style={{ width: '60%' }}>
                                                    <TextField
                                                        id="profile-name"
                                                        label=""
                                                        value={user.name || ''}
                                                        onChange={e =>
                                                            setUser(u => u && { ...u, name: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className={styles.row}>
                                                <span className={styles.label}>Nickname</span>
                                                <div style={{ width: '60%' }}>
                                                    <TextField
                                                        id="profile-nickname"
                                                        label=""
                                                        value={user.nickname || ''}
                                                        onChange={e =>
                                                            setUser(u => u && { ...u, nickname: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className={styles.row}>
                                                <span className={styles.label}>Email</span>
                                                <span className={styles.value}>{user.email}</span>
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
                                        <div className={styles.profileActions}>
                                            <Button variant="flat" onClick={() => setIsEditingProfile(false)}>
                                                Save
                                            </Button>
                                            <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* === РЕЖИМ ПРОСМОТРА === */}
                                        <div className={styles.viewHeader}>
                                            <ProfileAvatar
                                                currentUrl={user.avatarUrl}
                                                email={user.email}
                                                onUploaded={url => setUser(u => u && { ...u, avatarUrl: url })}
                                            />
                                            <div className={styles.viewHeaderText}>
                                                <div className={styles.viewName}>
                                                    {user.name || '—'}
                                                    {user.isVerified && <VerifiedBadge />}
                                                </div>
                                                <div className={styles.viewEmail}>
                                                    {user.email}
                                                    {user.emailVerified ? (
                                                        <span className={styles.badgeSuccess}>Verified</span>
                                                    ) : (
                                                        <span className={styles.badgeWarning}>Unverified</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.profileActions}>
                                            <Button variant="flat" onClick={() => setIsEditingProfile(true)}>
                                                Edit profile
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Panel>
                            <UpdateEmail
                                email={user.email}
                                onChanged={newEmail => setUser(u => u && { ...u, email: newEmail })}
                            />
                            <LinkedAccounts riotLinked={user.riotLinked} />
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className={styles.tabContent}>
                            <SecurityScore user={user} onEnable2fa={handleGoToTwoFa} />

                            <div ref={twoFaRef}>
                                <Panel title="Two-factor authentication (2FA)">
                                    {totpError && <p className={styles.errorBanner}>{totpError}</p>}
                                    {totpSetup ? (
                                        <div className={styles.totpSetup}>
                                            <div className={styles.totpStep}>
                                                <span className={styles.stepBadge}>1</span>
                                                <div>
                                                    <p className={styles.stepTitle}>Scan with your authenticator app</p>
                                                    <p className={styles.hintText}>
                                                        Google Authenticator, Authy, 1Password, or any TOTP app.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={styles.qrRow}>
                                                <div className={styles.qrCard}>
                                                    <QRCodeSVG value={totpSetup.otpauthUrl} size={168} />
                                                </div>
                                                <div className={styles.secretBlock}>
                                                    <span className={styles.secretLabel}>
                                                        Can&apos;t scan? Enter this code manually
                                                    </span>
                                                    <code className={styles.secretValue}>{totpSetup.secret}</code>
                                                </div>
                                            </div>

                                            <div className={styles.totpStep}>
                                                <span className={styles.stepBadge}>2</span>
                                                <div>
                                                    <p className={styles.stepTitle}>Save your recovery codes</p>
                                                    <p className={styles.hintText}>
                                                        Each code works once, if you ever lose access to your
                                                        authenticator app.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={styles.recoveryGrid}>
                                                {totpSetup.recoveryCodes.map(code => (
                                                    <code key={code} className={styles.recoveryChip}>
                                                        {code}
                                                    </code>
                                                ))}
                                            </div>

                                            <div className={styles.totpStep}>
                                                <span className={styles.stepBadge}>3</span>
                                                <div>
                                                    <p className={styles.stepTitle}>
                                                        Enter the 6-digit code from your app
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={styles.codeInputWrap}>
                                                <CodeInput value={totpCode} onChange={setTotpCode} autoFocus />
                                            </div>

                                            <div className={styles.totpActions}>
                                                <Button
                                                    variant="flat"
                                                    onClick={handleEnable2fa}
                                                    disabled={totpPending || totpCode.length < 6}
                                                >
                                                    {totpPending ? 'Enabling…' : 'Enable 2FA'}
                                                </Button>
                                                <Button variant="ghost" onClick={handleCancelSetup}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            {user.isTwoFactorEnabled ? (
                                                <>
                                                    <div className={styles.enabledBanner}>
                                                        <ShieldIcon />
                                                        <div>
                                                            <strong>2FA is enabled.</strong> You&apos;ll be asked for a
                                                            code from your authenticator app on every sign-in.
                                                        </div>
                                                    </div>
                                                    <div className={styles.totpActions}>
                                                        <Button variant="ghost" onClick={handleDisable2fa}>
                                                            Disable 2FA
                                                        </Button>
                                                        <Button variant="ghost" onClick={handleRegenCodes}>
                                                            New recovery codes
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p className={styles.hintText}>
                                                        Add an extra layer of security to your account.
                                                    </p>
                                                    <div style={{ marginTop: 12, maxWidth: 320 }}>
                                                        <PasswordField
                                                            id="setup-2fa-password"
                                                            label="Confirm your password"
                                                            autoComplete="current-password"
                                                            value={setupPassword}
                                                            onChange={setSetupPassword}
                                                        />
                                                    </div>
                                                    <div style={{ marginTop: 12 }}>
                                                        <Button
                                                            variant="flat"
                                                            onClick={handleSetup2fa}
                                                            disabled={setupPending || !setupPassword}
                                                        >
                                                            {setupPending ? 'Starting…' : 'Set up 2FA'}
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </Panel>
                            </div>
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
