import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { PasswordRequirements } from '../../shared/ui/PasswordRequirements';
import { isPasswordValid } from '../../shared/lib/passwordRules';
import { register, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const NICKNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function RegisterPage() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const passwordsMatch = confirmPassword.length === 0 || confirmPassword === password;
    const canSubmit =
        name.trim().length > 0 &&
        NICKNAME_RE.test(nickname) &&
        isPasswordValid(password) &&
        confirmPassword === password &&
        agreed;

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await register(email, password, name.trim(), nickname);
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
                    id="name"
                    label="Name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <TextField
                    id="nickname"
                    label="Nickname"
                    type="text"
                    autoComplete="username"
                    placeholder="letters, numbers, underscore"
                    required
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                />
                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <div className={styles.passwordField}>
                    <TextField
                        id="password"
                        label="Password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <PasswordRequirements password={password} />
                </div>
                <div>
                    <TextField
                        id="confirm-password"
                        label="Repeat password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                    />
                    {!passwordsMatch && <p className={styles.mismatch}>Passwords don&apos;t match.</p>}
                </div>
                <label className={styles.agree}>
                    <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                    <span>
                        I agree to the <Link to="/terms">Terms of Use</Link>, <Link to="/privacy">Privacy Policy</Link>,
                        and <Link to="/cookies">Cookie Policy</Link>.
                    </span>
                </label>
                <Button type="submit" variant="flat" fullWidth disabled={pending || !canSubmit}>
                    {pending ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
