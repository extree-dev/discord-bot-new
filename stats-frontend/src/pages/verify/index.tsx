import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { verifyCode, resendCode, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function VerifyPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') ?? '';
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [resending, setResending] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setNotice(null);
        setPending(true);
        try {
            await verifyCode(email, code);
            navigate('/account');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onResend() {
        setError(null);
        setNotice(null);
        setResending(true);
        try {
            await resendCode(email);
            setNotice('A new code is on its way.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setResending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="Almost there"
            heading={
                <>
                    Check your
                    <br />
                    <span className="hl">email.</span>
                </>
            }
            lead={
                email
                    ? `We sent a 6-digit code to ${email}. Enter it below to finish setting up your account.`
                    : 'Enter the 6-digit code we sent you to finish setting up your account.'
            }
            cardTitle="Verify"
            error={error}
            footer={
                <button type="button" className={styles.resend} onClick={onResend} disabled={resending}>
                    {resending ? 'Sending…' : (notice ?? "Didn't get it? Resend code")}
                </button>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                <TextField
                    id="code"
                    label="Verification code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <Button type="submit" variant="flat" fullWidth disabled={pending}>
                    {pending ? 'Verifying…' : 'Verify'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
