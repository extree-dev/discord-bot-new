import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { PasswordField } from '../../shared/ui/PasswordField';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/ErrorBanner';
import { PasswordRequirements } from '../../shared/ui/PasswordRequirements';
import { isPasswordValid } from '../../shared/lib/passwordRules';
import { resetPassword, ApiError } from '../../shared/api/statsAuth';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const { refresh } = useAuth();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [needsTotp, setNeedsTotp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const canSubmit = isPasswordValid(password) && confirmPassword === password;

    async function submitReset(code?: string) {
        setError(null);
        setPending(true);
        try {
            await resetPassword(token, password, code);
            await refresh();
            navigate('/account');
        } catch (err) {
            if (err instanceof ApiError && err.code === 'reset_totp_required') {
                setNeedsTotp(true);
                setError(null);
                return;
            }
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        void submitReset();
    }

    function onSubmitTotp(e: FormEvent) {
        e.preventDefault();
        void submitReset(totpCode.trim());
    }

    return (
        <SplitAuthLayout
            sideTitle={
                <>
                    Set a new
                    <br />
                    <span className="hl">password.</span>
                </>
            }
            badge="Almost there"
            heading="New password"
            lead="Choose a new password for your account. You'll be signed in right after."
            footer={
                <>
                    Link not working? <Link to="/forgot-password">Request a new one</Link>
                </>
            }
        >
            {!token ? (
                <p className={styles.missing}>
                    This link is missing its reset code. <Link to="/forgot-password">Request a new one</Link>.
                </p>
            ) : needsTotp ? (
                <form className={styles.form} onSubmit={onSubmitTotp}>
                    <p className={styles.missing}>
                        2FA is enabled on this account — enter a code from your authenticator app (or a recovery code)
                        to finish resetting your password.
                    </p>
                    <TextField
                        id="reset-totp-code"
                        label="2FA code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={totpCode}
                        onChange={e => setTotpCode(e.target.value)}
                    />
                    {error && <ErrorBanner>{error}</ErrorBanner>}
                    <Button type="submit" variant="flat" fullWidth disabled={pending || totpCode.trim().length < 6}>
                        {pending ? 'Verifying…' : 'Verify & set new password'}
                    </Button>
                </form>
            ) : (
                <form className={styles.form} onSubmit={onSubmit}>
                    {error && <ErrorBanner>{error}</ErrorBanner>}
                    <div className={styles.passwordField}>
                        <PasswordField
                            id="password"
                            label="New password"
                            autoComplete="new-password"
                            required
                            showGenerate
                            value={password}
                            onChange={setPassword}
                        />
                        <PasswordRequirements password={password} />
                    </div>
                    <div>
                        <PasswordField
                            id="confirm-password"
                            label="Repeat password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                        />
                        {confirmPassword.length > 0 && confirmPassword !== password && (
                            <p className={styles.mismatch}>Passwords don&apos;t match.</p>
                        )}
                    </div>
                    <Button type="submit" variant="flat" fullWidth disabled={pending || !canSubmit}>
                        {pending ? 'Saving…' : 'Set new password'}
                    </Button>
                </form>
            )}
        </SplitAuthLayout>
    );
}
