import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { PasswordField } from '../../shared/ui/PasswordField';
import { Button } from '../../shared/ui/Button';
import { PasswordRequirements } from '../../shared/ui/PasswordRequirements';
import { isPasswordValid } from '../../shared/lib/passwordRules';
import { resetPassword, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// "Generate" (заполняет поле случайным сильным паролем) и переключатель
// видимости — именно здесь, в окне сброса пароля, как и просили: здесь
// человек впервые видит новый пароль и должен быть уверен, что ввёл то,
// что собирался, прежде чем он окажется только в менеджере паролей.
export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const canSubmit = isPasswordValid(password) && confirmPassword === password;

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await resetPassword(token, password);
            navigate('/account');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="Almost there"
            heading={
                <>
                    Set a new
                    <br />
                    <span className="hl">password.</span>
                </>
            }
            lead="Choose a new password for your account. You'll be signed in right after."
            cardTitle="New password"
            error={error}
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
            ) : (
                <form className={styles.form} onSubmit={onSubmit}>
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
