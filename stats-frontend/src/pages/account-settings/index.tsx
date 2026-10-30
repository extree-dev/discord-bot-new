import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BackButton } from '../../shared/ui/BackButton';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { ProfileAvatar } from '../../shared/ui/ProfileAvatar';
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
import { DeleteAccountModal } from '../../features/delete-account';
import { useToast } from '../../shared/ui/Toast/useToast';
import { Select } from '../../shared/ui/Select';
import styles from './index.module.scss';
import { SettingsSkeleton } from './skeleton';
import { AccountStatusCard } from './status-card';
import { VerifiedBadge } from '../../shared/ui/VerifiedBadge';
import { TextField } from '../../shared/ui/TextField';
import { PasswordField } from '../../shared/ui/PasswordField';
import { CodeInput } from '../../shared/ui/CodeInput';
import { ShieldIcon, BellIcon } from '../../shared/ui/Icons';
import { EmptyState } from '../../shared/ui/EmptyState';
import { QRCodeSVG } from 'qrcode.react';

export function AccountSettingsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();

    // Читаем активную вкладку из URL (profile по умолчанию)
    const tabParam = searchParams.get('tab') as 'profile' | 'security' | 'notifications' | null;
    const activeTab = tabParam || 'profile';

    const [user, setUser] = useState<AccountUser | null>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [banned, setBanned] = useState(false);
    const [twoFaModalOpen, setTwoFaModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string; recoveryCodes: string[] } | null>(
        null
    );
    const [totpCode, setTotpCode] = useState('');
    const [totpPending, setTotpPending] = useState(false);
    const [totpError, setTotpError] = useState<string | null>(null);
    const [setupPassword, setSetupPassword] = useState('');
    const [setupPending, setSetupPending] = useState(false);

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

    function handleCloseTwoFaModal() {
        setTwoFaModalOpen(false);
        setTotpSetup(null);
        setTotpCode('');
        setSetupPassword('');
        setTotpError(null);
    }

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
            await enable2fa(totpCode.trim(), setupPassword);
            const fresh = await getAccount();
            if (fresh.user) setUser(fresh.user);
            handleCloseTwoFaModal();
            showToast('2FA enabled. Your account is now fully secured.', 'success');
        } catch (e) {
            setTotpError(e instanceof Error ? e.message : 'Failed to enable 2FA');
        } finally {
            setTotpPending(false);
        }
    }

    async function handleDisable2fa() {
        const pwd = prompt('Enter your password to disable 2FA:');
        if (!pwd) return;
        try {
            await disable2fa(pwd);
            const fresh = await getAccount();
            if (fresh.user) setUser(fresh.user);
            showToast('2FA disabled.', 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to disable 2FA', 'error');
        }
    }

    async function handleRegenCodes() {
        const pwd = prompt('Enter your password to regenerate recovery codes:');
        if (!pwd) return;
        try {
            const r = await regenerateRecoveryCodes(pwd);
            alert('New recovery codes (save them):\n\n' + r.recoveryCodes.join('\n'));
            showToast('New recovery codes generated.', 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to regenerate codes', 'error');
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

    if (!user) {
        return (
            <DashboardShell user={null} title="" wide>
                <SettingsSkeleton />
            </DashboardShell>
        );
    }

    return (
        <DashboardShell user={{ email: user.email, isAdmin: user.isAdmin }} title="" wide>
            <div className={styles.page}>
                <BackButton to="/account" label="Back to Dashboard" />
                <h1 className={styles.title}>Settings</h1>

                <div className={styles.layoutContent}>
                    <main>
                        {activeTab === 'profile' && (
                            <div className={styles.tabContent}>
                                <Panel title="Personal Information">
                                    {isEditingProfile ? (
                                        <>
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
                                <div className={styles.securityGrid}>
                                    <SecurityScore user={user} onEnable2fa={() => setTwoFaModalOpen(true)} />
                                    <AccountStatusCard user={user} />
                                </div>

                                <div className={styles.securityGrid}>
                                    <Panel title="Two-factor authentication (2FA)">
                                        {user.isTwoFactorEnabled ? (
                                            <>
                                                <div className={styles.enabledBanner}>
                                                    <ShieldIcon />
                                                    <div>
                                                        <strong>2FA is enabled.</strong> You'll be asked for a code from
                                                        your authenticator app on every sign-in.
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
                                            <div className={styles.twoFaCta}>
                                                <span className={styles.twoFaCtaIcon}>
                                                    <ShieldIcon />
                                                </span>
                                                <p className={styles.hintText}>
                                                    Add an extra layer of security to your account.
                                                </p>
                                                <Button variant="flat" onClick={() => setTwoFaModalOpen(true)}>
                                                    Set up 2FA
                                                </Button>
                                            </div>
                                        )}
                                    </Panel>
                                    <UpdatePassword />
                                </div>

                                <ActiveSessions />

                                <Panel title="Danger Zone" className={styles.dangerPanel}>
                                    <div className={styles.dangerRow}>
                                        <div>
                                            <h4>Delete Account</h4>
                                            <p className={styles.hintText}>Once deleted, there is no going back.</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            className={styles.deleteAccountBtn}
                                            onClick={() => setDeleteModalOpen(true)}
                                        >
                                            Delete Account
                                        </Button>
                                    </div>
                                </Panel>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className={styles.tabContent}>
                                <Panel>
                                    <EmptyState
                                        icon={<BellIcon />}
                                        title="Notification preferences aren't available yet"
                                        description="We're still building this out — check back soon."
                                    />
                                </Panel>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <Modal
                open={twoFaModalOpen}
                onClose={handleCloseTwoFaModal}
                title="Set up two-factor authentication"
                labelledBy="twofa-modal-title"
            >
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
                                <span className={styles.secretLabel}>Can't scan? Enter this code manually</span>
                                <code className={styles.secretValue}>{totpSetup.secret}</code>
                            </div>
                        </div>

                        <div className={styles.totpStep}>
                            <span className={styles.stepBadge}>2</span>
                            <div>
                                <p className={styles.stepTitle}>Save your recovery codes</p>
                                <p className={styles.hintText}>
                                    Each code works once, if you ever lose access to your authenticator app.
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
                                <p className={styles.stepTitle}>Enter the 6-digit code from your app</p>
                            </div>
                        </div>
                        <div className={styles.codeInputWrap}>
                            <CodeInput value={totpCode} onChange={setTotpCode} autoFocus />
                        </div>

                        <div className={styles.totpActions}>
                            <Button
                                variant="flat"
                                onClick={handleEnable2fa}
                                loading={totpPending}
                                disabled={totpCode.length < 6}
                            >
                                {totpPending ? 'Enabling…' : 'Enable 2FA'}
                            </Button>
                            <Button variant="ghost" onClick={handleCloseTwoFaModal}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className={styles.hintText}>Confirm your password to continue.</p>
                        <div style={{ marginTop: 12, maxWidth: 320 }}>
                            <PasswordField
                                id="setup-2fa-password"
                                label="Confirm your password"
                                autoComplete="current-password"
                                value={setupPassword}
                                onChange={setSetupPassword}
                            />
                        </div>
                        <div className={styles.totpActions} style={{ marginTop: 16 }}>
                            <Button
                                variant="flat"
                                onClick={handleSetup2fa}
                                loading={setupPending}
                                disabled={!setupPassword}
                            >
                                {setupPending ? 'Starting…' : 'Continue'}
                            </Button>
                            <Button variant="ghost" onClick={handleCloseTwoFaModal}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <DeleteAccountModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
        </DashboardShell>
    );
}
