import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { register, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function RegisterPage() {
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
            await register(email, password);
            navigate(`/verify?email=${encodeURIComponent(email)}`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <AuthCard
            title="Create your account"
            subtitle="Sign up with email — you can connect your Riot account later."
            error={error}
            footer={
                <>
                    Already have an account? <Link to="/login">Sign in</Link>
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
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <Button type="submit" variant="primary" fullWidth disabled={pending}>
                    {pending ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </AuthCard>
    );
}
