import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { CodeInput } from '../../shared/ui/CodeInput';
import { PasswordRequirements } from '../../shared/ui/PasswordRequirements';
import { isPasswordValid } from '../../shared/lib/passwordRules';
import {
    getAccount,
    getLoginHistory,
    requestEmailChange,
    resendEmailChangeCode,
    confirmEmailChange,
    changePassword,
    ApiError,
    type AccountUser,
    type LoginEvent,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

const CODE_LENGTH = 6;

// Смена email — всегда требует текущий пароль ("step-up"-проверка, см.
// server.js) и подтверждение кодом на НОВЫЙ адрес, прежде чем он реально
// запишется — два отдельных шага формы в одном компоненте.
function ChangeEmailSection({ email, onChanged }: { email: string; onChanged: (newEmail: string) => void }) {
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [resending, setResending] = useState(false);

    async function onRequest(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await requestEmailChange(currentPassword, newEmail);
            setStep('code');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onConfirm(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            const result = await confirmEmailChange(code);
            onChanged(result.user.email);
            setStep('form');
            setCurrentPassword('');
            setNewEmail('');
            setCode('');
            setNotice('Email updated.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onResend() {
        setError(null);
        setResending(true);
        try {
            await resendEmailChangeCode();
            setNotice('A new code is on its way.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setResending(false);
        }
    }

    return (
        <Panel title="Change email">
            {error && (
                <p className={styles.sectionError} role="alert">
                    {error}
                </p>
            )}
            {notice && step === 'form' && <p className={styles.sectionNotice}>{notice}</p>}

            {step === 'form' ? (
                <form className={styles.form} onSubmit={onRequest}>
                    <TextField
                        id="change-email-current-password"
                        label="Current password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                    />
                    <TextField
                        id="change-email-new"
                        label="New email"
                        type="email"
                        autoComplete="email"
                        placeholder={email}
                        required
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                    />
                    <Button type="submit" variant="flat" fullWidth disabled={pending}>
                        {pending ? 'Sending code…' : 'Send confirmation code'}
                    </Button>
                </form>
            ) : (
                <form className={styles.form} onSubmit={onConfirm}>
                    <p className={styles.sectionHint}>
                        We sent a 6-digit code to <strong>{newEmail}</strong>.
                    </p>
                    <CodeInput length={CODE_LENGTH} value={code} onChange={setCode} disabled={pending} autoFocus />
                    <Button type="submit" variant="flat" fullWidth disabled={pending || code.length < CODE_LENGTH}>
                        {pending ? 'Confirming…' : 'Confirm new email'}
                    </Button>
                    <button type="button" className={styles.linkButton} onClick={onResend} disabled={resending}>
                        {resending ? 'Sending…' : (notice ?? "Didn't get it? Resend code")}
                    </button>
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => {
                            setStep('form');
                            setCode('');
                            setError(null);
                            setNotice(null);
                        }}
                    >
                        Cancel
                    </button>
                </form>
            )}
        </Panel>
    );
}

function formatLocation(event: LoginEvent): string {
    if (!event.country) return 'Unknown location';
    return event.city ? `${event.city}, ${event.country}` : event.country;
}

// Read-only — тот же набор полей (время/локация/IP), что в письме
// "New sign-in to your account" (см. mailer.js), просто список вместо
// одного события за раз.
function LoginHistorySection() {
    const [events, setEvents] = useState<LoginEvent[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        getLoginHistory().then(result => {
            if (!cancelled) setEvents(result);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <Panel title="Recent sign-ins">
            {events === null && <p className={styles.sectionHint}>Loading…</p>}
            {events?.length === 0 && <p className={styles.sectionHint}>No recent sign-ins on record.</p>}
            {events && events.length > 0 && (
                <ul className={styles.loginList}>
                    {events.map(event => (
                        <li key={event.id} className={styles.loginItem}>
                            <div className={styles.loginItemTime}>{event.time}</div>
                            <div className={styles.loginItemMeta}>
                                {formatLocation(event)}
                                {event.ip && <span className={styles.loginItemIp}> · {event.ip}</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function ChangePasswordSection() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [pending, setPending] = useState(false);

    const passwordsMatch = confirmPassword.length === 0 || confirmPassword === newPassword;
    const canSubmit = currentPassword.length > 0 && isPasswordValid(newPassword) && confirmPassword === newPassword;

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        setPending(true);
        try {
            await changePassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSuccess(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Panel title="Change password">
            {error && (
                <p className={styles.sectionError} role="alert">
                    {error}
                </p>
            )}
            {success && <p className={styles.sectionNotice}>Password updated.</p>}
            <form className={styles.form} onSubmit={onSubmit}>
                <TextField
                    id="change-password-current"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                />
                <div className={styles.passwordField}>
                    <TextField
                        id="change-password-new"
                        label="New password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                    />
                    <PasswordRequirements password={newPassword} />
                </div>
                <div>
                    <TextField
                        id="change-password-confirm"
                        label="Repeat new password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                    />
                    {!passwordsMatch && <p className={styles.mismatch}>Passwords don&apos;t match.</p>}
                </div>
                <Button type="submit" variant="flat" fullWidth disabled={pending || !canSubmit}>
                    {pending ? 'Updating…' : 'Update password'}
                </Button>
            </form>
        </Panel>
    );
}

export function AccountPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<AccountUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getAccount().then(result => {
            if (cancelled) return;
            if (!result) {
                navigate('/login');
                return;
            }
            setUser(result);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    if (loading || !user) {
        return (
            <DashboardShell user={null} title="Account">
                Loading…
            </DashboardShell>
        );
    }

    return (
        <DashboardShell user={{ email: user.email, isAdmin: user.isAdmin }} active="account" title="Account">
            <Panel title="Profile">
                {user.name && (
                    <div className={styles.row}>
                        <span className={styles.label}>Name</span>
                        <span className={styles.value}>{user.name}</span>
                    </div>
                )}
                {user.nickname && (
                    <div className={styles.row}>
                        <span className={styles.label}>Nickname</span>
                        <span className={styles.value}>{user.nickname}</span>
                    </div>
                )}
                <div className={styles.row}>
                    <span className={styles.label}>Email</span>
                    <span className={styles.value}>{user.email}</span>
                </div>
            </Panel>

            <LoginHistorySection />
            <ChangeEmailSection
                email={user.email}
                onChanged={newEmail => setUser(u => u && { ...u, email: newEmail })}
            />
            <ChangePasswordSection />

            {/* Riot-привязка — будущая функция (см. riot_puuid/riot_linked_at в
                stats-backend/db.js), пока RSO недоступен (Riot ещё не одобрил
                продукт) кнопка честно отключена, а не притворяется рабочей. */}
            <Panel title="Riot account">
                <p className={styles.riotDesc}>
                    Not connected yet — this is coming once Riot Sign-On is live for Extree Stats.
                </p>
                <button type="button" className={styles.riotButton} disabled>
                    Connect Riot account — coming soon
                </button>
                <p className={styles.riotDisclaimer}>{RIOT_DISCLAIMER}</p>
            </Panel>

            <Link className={styles.footerLink} to="/support">
                Contact support
            </Link>
        </DashboardShell>
    );
}
