import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Checkbox';
import { Turnstile } from '../../shared/ui/Turnstile';
import { TURNSTILE_SITE_KEY } from '../../shared/config';
import { login, verify2fa, ApiError } from '../../shared/api/statsAuth';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

export function LoginPage() {
    const navigate = useNavigate();
    const { refresh } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const [pending, setPending] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileKey, setTurnstileKey] = useState(0);
    const [rememberMe, setRememberMe] = useState(true);
    const [requires2fa, setRequires2fa] = useState(false);
    const [totpCode, setTotpCode] = useState('');

    function triggerShake() {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            if (requires2fa) {
                await verify2fa(email, totpCode, rememberMe);
                await refresh();
                navigate('/account');
                return;
            }
            await login(email, password, turnstileToken, rememberMe);
            await refresh();
            navigate('/account');
        } catch (err) {
            if (err instanceof ApiError && err.code === 'email_not_verified') {
                navigate(`/verify?email=${encodeURIComponent(email)}`);
                return;
            }
            if (err instanceof ApiError && err.code === 'unknown_location') {
                navigate(`/verify-location?email=${encodeURIComponent(email)}`);
                return;
            }
            if (err instanceof ApiError && err.code === 'requires_2fa') {
                setRequires2fa(true);
                return;
            }
            if (err instanceof ApiError && err.code === 'banned') {
                setError(err.message);
                triggerShake();
                return;
            }
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            setTurnstileToken('');
            setTurnstileKey(k => k + 1);
            triggerShake();
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            sideTitle={
                <>
                    Good to
                    <br />
                    <span className="hl">see you again.</span>
                </>
            }
            badge="Welcome back"
            heading="Sign in"
            lead="Sign in to check your win rates, K/D trends, and rank progress — right where you left off."
            footer={
                <>
                    Don&apos;t have an account? <Link to="/register">Create one</Link>
                </>
            }
        >
            <form className={isShaking ? `${styles.form} ${styles.shake}` : styles.form} onSubmit={onSubmit}>
                {error && <div className={styles.error}>{error}</div>}

                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    icon={
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    }
                />
                <TextField
                    id="password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    icon={
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    }
                />

                <div className={styles.row}>
                    <Checkbox
                        id="remember-me"
                        label="Remember me"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                    />
                    <Link to="/forgot-password" className={styles.forgot}>
                        Forgot password?
                    </Link>
                </div>

                <Turnstile
                    key={turnstileKey}
                    siteKey={TURNSTILE_SITE_KEY}
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                />

                {requires2fa ? (
                    <>
                        <TextField
                            id="totp-code"
                            label="2FA code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                            value={totpCode}
                            onChange={e => setTotpCode(e.target.value)}
                        />
                        <Button type="submit" variant="flat" fullWidth disabled={pending || totpCode.length < 6}>
                            {pending ? 'Verifying…' : 'Verify 2FA'}
                        </Button>
                    </>
                ) : (
                    <Button
                        type="submit"
                        variant="flat"
                        fullWidth
                        disabled={pending || (requires2fa ? totpCode.length < 6 : !turnstileToken)}
                    >
                        {pending ? 'Signing in…' : 'Sign in'}
                    </Button>
                )}
            </form>
        </SplitAuthLayout>
    );
}
