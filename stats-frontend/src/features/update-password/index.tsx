import { useState, type FormEvent } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { PasswordRequirements } from '../../shared/ui/PasswordRequirements';
import { isPasswordValid } from '../../shared/lib/passwordRules';
import { changePassword, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function UpdatePassword() {
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
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Panel title="Change password">
            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.notice}>Password updated.</p>}
            <form className={styles.form} onSubmit={onSubmit}>
                <TextField
                    id="pass-cur"
                    label="Current password"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                />
                <div className={styles.passField}>
                    <TextField
                        id="pass-new"
                        label="New password"
                        type="password"
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                    />
                    <PasswordRequirements password={newPassword} />
                </div>
                <div>
                    <TextField
                        id="pass-conf"
                        label="Repeat new password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                    />
                    {!passwordsMatch && <p className={styles.mismatch}>Passwords don't match.</p>}
                </div>
                <Button type="submit" variant="flat" fullWidth disabled={pending || !canSubmit}>
                    {pending ? 'Updating…' : 'Update password'}
                </Button>
            </form>
        </Panel>
    );
}
