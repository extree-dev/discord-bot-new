import { useState, type FormEvent } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { CodeInput } from '../../shared/ui/CodeInput';
import { useToast } from '../../shared/ui/Toast/useToast';
import { requestEmailChange, confirmEmailChange, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CODE_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UpdateEmail({ email, onChanged }: { email: string; onChanged: (newEmail: string) => void }) {
    const { showToast } = useToast();
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const emailInvalid = emailTouched && newEmail.length > 0 && !EMAIL_RE.test(newEmail);

    async function onRequest(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await requestEmailChange(currentPassword, newEmail);
            setStep('code');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setPending(false);
        }
    }

    async function onConfirm(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            const result = await confirmEmailChange(code);
            onChanged(result.user.email);
            setStep('form');
            setCurrentPassword('');
            setNewEmail('');
            setEmailTouched(false);
            setCode('');
            showToast('Email updated.', 'success');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Panel title="Change email">
            {error && <p className={styles.error}>{error}</p>}
            {step === 'form' ? (
                <form className={styles.form} onSubmit={onRequest}>
                    <TextField
                        id="email-pass"
                        label="Current password"
                        type="password"
                        required
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                    />
                    <TextField
                        id="email-new"
                        label="New email"
                        type="email"
                        placeholder={email}
                        required
                        error={emailInvalid}
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                    />
                    {emailInvalid && <p className={styles.fieldError}>Enter a valid email address.</p>}
                    <div className={styles.actions}>
                        <Button type="submit" variant="flat" loading={pending} disabled={emailInvalid}>
                            {pending ? 'Sending code…' : 'Send confirmation code'}
                        </Button>
                    </div>
                </form>
            ) : (
                <form className={styles.form} onSubmit={onConfirm}>
                    <p className={styles.hint}>
                        We sent a 6-digit code to <strong>{newEmail}</strong>.
                    </p>
                    <CodeInput length={CODE_LENGTH} value={code} onChange={setCode} disabled={pending} autoFocus />
                    <div className={styles.actions}>
                        <Button type="submit" variant="flat" loading={pending} disabled={code.length < CODE_LENGTH}>
                            {pending ? 'Confirming…' : 'Confirm new email'}
                        </Button>
                    </div>
                    <button type="button" className={styles.linkBtn} onClick={() => setStep('form')}>
                        Cancel
                    </button>
                </form>
            )}
        </Panel>
    );
}
