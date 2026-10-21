import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Checkbox';
import { Turnstile } from '../../shared/ui/Turnstile';
import { TURNSTILE_SITE_KEY } from '../../shared/config';
import { login, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    // Токен Turnstile одноразовый — бэкенд списывает его при каждой
    // попытке входа, даже неудачной (см. stats-backend/server.js). Смена
    // key пересоздаёт виджет и даёт свежий токен вместо попытки
    // переиспользовать уже потраченный.
    const [turnstileKey, setTurnstileKey] = useState(0);
    const [rememberMe, setRememberMe] = useState(true);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await login(email, password, turnstileToken, rememberMe);
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
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            setTurnstileToken('');
            setTurnstileKey(k => k + 1);
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="Welcome back"
            heading={
                <>
                    Good to
                    <br />
                    <span className="hl">see you again.</span>
                </>
            }
            lead="Sign in to check your win rates, K/D trends, and rank progress — right where you left off."
            cardTitle="Sign in"
            error={error}
            footer={
                <>
                    Don&apos;t have an account? <Link to="/register">Create one</Link>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <TextField
                    id="password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
                <Button type="submit" variant="flat" fullWidth disabled={pending || !turnstileToken}>
                    {pending ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
