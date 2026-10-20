import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { CodeInput } from '../../shared/ui/CodeInput';
import { Button } from '../../shared/ui/Button';
import { confirmLoginLocation, resendLoginCode, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CODE_LENGTH = 6;

// Отдельная от pages/verify страница — тот же код-инпут и раскладка, но
// другой смысл: это не подтверждение email при регистрации, а
// подтверждение входа с места, которого раньше не видели для этого
// аккаунта (см. /auth/login → unknown_location в stats-backend/server.js).
// Два разных эндпоинта/две разные таблицы кодов на бэкенде, поэтому и
// страницы разные, а не одна с параметром.
export function VerifyLocationPage() {
    const navigate = useNavigate();
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
            await confirmLoginLocation(email, value);
            navigate('/account');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            submittedCode.current = null;
        } finally {
            setPending(false);
        }
    }

    useEffect(() => {
        if (code.length === CODE_LENGTH && !pending && submittedCode.current !== code) {
            submittedCode.current = code;
            void submit(code);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, pending]);

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
            await resendLoginCode(email);
            setNotice('A new code is on its way.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setResending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="New sign-in location"
            heading={
                <>
                    Confirm it&apos;s
                    <br />
                    <span className="hl">really you.</span>
                </>
            }
            lead={
                email
                    ? `We sent a 6-digit code to ${email} — we haven't seen a sign-in from this location before.`
                    : "We haven't seen a sign-in from this location before. Enter the code we emailed you."
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
