import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { CodeInput } from '../../shared/ui/CodeInput';
import { Button } from '../../shared/ui/Button';
import { verifyCode, resendCode, ApiError } from '../../shared/api/statsAuth';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

const CODE_LENGTH = 6;

export function VerifyPage() {
    const navigate = useNavigate();
    const { refresh } = useAuth();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') ?? '';
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [resending, setResending] = useState(false);
    const submittedCode = useRef<string | null>(null);

    async function submit(value: string) {
        setError(null);
        setNotice(null);
        setPending(true);
        try {
            await verifyCode(email, value);
            await refresh();
            navigate('/account');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    useEffect(() => {
        if (code.length === CODE_LENGTH && !pending && submittedCode.current !== code) {
            submittedCode.current = code;
            void submit(code);
        }
    }, [code, pending]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (code.length === CODE_LENGTH) {
            submittedCode.current = code;
        }
        await submit(code);
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
            sideTitle={
                <>
                    Check your
                    <br />
                    <span className="hl">email.</span>
                </>
            }
            badge="Almost there"
            heading="Verify"
            lead={
                email
                    ? `We sent a 6-digit code to ${email}. Enter it below to finish setting up your account.`
                    : 'Enter the 6-digit code we sent you to finish setting up your account.'
            }
            footer={
                <button type="button" className={styles.resend} onClick={onResend} disabled={resending}>
                    {resending ? 'Sending…' : (notice ?? "Didn't get it? Resend code")}
                </button>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.codeField}>
                    <span className={styles.codeLabel}>Verification code</span>
                    <CodeInput length={CODE_LENGTH} value={code} onChange={setCode} disabled={pending} autoFocus />
                </div>
                <Button type="submit" variant="flat" fullWidth disabled={pending || code.length < CODE_LENGTH}>
                    {pending ? 'Verifying…' : 'Verify'}
                </Button>
            </form>
        </SplitAuthLayout>
    );
}
