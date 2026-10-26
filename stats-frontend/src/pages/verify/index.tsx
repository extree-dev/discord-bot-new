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
            // Не сбрасываем submittedCode здесь: иначе следующий рендер
            // (pending: true -> false) снова проходит условие эффекта ниже
            // (код тот же, submittedCode пуст) и тот же код уходит на сервер
            // заново — и так по кругу при любой ошибке, визуально выглядит
            // как вечное "Verifying…" (см. тот же фикс в pages/verify-location).
            // submittedCode остаётся равным code — explicit "Verify" (onSubmit)
            // и ввод НОВОГО кода (меняет code) всё равно работают как раньше.
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    // Автосабмит, когда введены все 6 цифр — тот же UX, что в большинстве
    // приложений с OTP-ячейками (см. CodeInput): не нужно отдельно жать
    // "Verify" после последней цифры. Кнопка ниже остаётся как явный
    // резерв (вставка кода целиком, автозаполнение из автозаполнителя и т.п.)
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
