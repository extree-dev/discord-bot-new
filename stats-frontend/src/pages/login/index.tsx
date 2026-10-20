import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { login, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await login(email, password);
            navigate('/account');
        } catch (err) {
            if (err instanceof ApiError && err.code === 'email_not_verified') {
                navigate(`/verify?email=${encodeURIComponent(email)}`);
                return;
            }
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <AuthCard
            title="Sign in"
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
                <Button type="submit" variant="primary" fullWidth disabled={pending}>
                    {pending ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </AuthCard>
    );
}
