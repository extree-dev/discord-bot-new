import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { register, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function RegisterPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
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
        <SplitAuthLayout
            badge="Free account — 30 seconds"
            heading={
                <>
                    Track your game.
                    <br />
                    <span className="hl">Match by match.</span>
                </>
            }
            lead="Create a free account to save your lookups, track trends over time, and unlock your activity feed."
            cardTitle="Create account"
            error={error}
            footer={
                <>
                    Already have an account? <Link to="/login">Log in</Link>
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
                <label className={styles.agree}>
                    <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                    <span>
                        I agree to the <Link to="/terms">Terms of Use</Link>, <Link to="/privacy">Privacy Policy</Link>,
                        and <Link to="/cookies">Cookie Policy</Link>.
                    </span>
                </label>
                <Button type="submit" variant="flat" fullWidth disabled={pending || !agreed}>
                    {pending ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
