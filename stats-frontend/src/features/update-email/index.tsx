import { useState, type FormEvent } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { CodeInput } from '../../shared/ui/CodeInput';
import { requestEmailChange, confirmEmailChange, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CODE_LENGTH = 6;

export function UpdateEmail({ email, onChanged }: { email: string; onChanged: (newEmail: string) => void }) {
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

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
            setCode('');
            setNotice('Email updated.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Panel title="Change email">
            {error && <p className={styles.error}>{error}</p>}
            {notice && step === 'form' && <p className={styles.notice}>{notice}</p>}
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
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                    />
                    <Button type="submit" variant="flat" fullWidth disabled={pending}>
                        {pending ? 'Sending code…' : 'Send confirmation code'}
                    </Button>
                </form>
            ) : (
                <form className={styles.form} onSubmit={onConfirm}>
                    <p className={styles.hint}>
                        We sent a 6-digit code to <strong>{newEmail}</strong>.
                    </p>
                    <CodeInput length={CODE_LENGTH} value={code} onChange={setCode} disabled={pending} autoFocus />
                    <Button type="submit" variant="flat" fullWidth disabled={pending || code.length < CODE_LENGTH}>
                        {pending ? 'Confirming…' : 'Confirm new email'}
                    </Button>
                    <button type="button" className={styles.linkBtn} onClick={() => setStep('form')}>
                        Cancel
                    </button>
                </form>
            )}
        </Panel>
    );
}
