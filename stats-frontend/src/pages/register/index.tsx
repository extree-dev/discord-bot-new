import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Checkbox';
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
    const [isShaking, setIsShaking] = useState(false);
    const [pending, setPending] = useState(false);

    const passwordsMatch = confirmPassword.length === 0 || confirmPassword === password;
    const canSubmit =
        name.trim().length > 0 &&
        NICKNAME_RE.test(nickname) &&
        isPasswordValid(password) &&
        confirmPassword === password &&
        agreed;

    function triggerShake() {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!canSubmit) {
            setError('Please fill in all fields correctly and accept the terms.');
            triggerShake();
            return;
        }
        setError(null);
        setPending(true);
        try {
            await register(email, password, name.trim(), nickname);
            navigate(`/verify?email=${encodeURIComponent(email)}`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            triggerShake();
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            sideTitle={
                <>
                    Track your game.
                    <br />
                    <span className="hl">Match by match.</span>
                </>
            }
            badge="Join us"
            heading="Create account"
            lead="Create a free account to save your lookups, track trends over time, and unlock your activity feed."
            footer={
                <>
                    Already have an account? <Link to="/login">Log in</Link>
                </>
            }
        >
            <form className={isShaking ? `${styles.form} ${styles.shake}` : styles.form} onSubmit={onSubmit}>
                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.rowSplit}>
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
                        required
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                    />
                </div>

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

                <div className={styles.passwordField}>
                    <TextField
                        id="password"
                        label="Password"
                        type="password"
                        autoComplete="new-password"
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
                    {!passwordsMatch && <p className={styles.mismatch}>Passwords don&apos;t match.</p>}
                </div>

                <Checkbox
                    id="agree-terms"
                    label="I agree to the Terms, Privacy Policy, and Cookies."
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                />

                <Button type="submit" variant="flat" fullWidth disabled={pending}>
                    {pending ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
