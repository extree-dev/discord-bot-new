import { useState } from 'react';
import { ApiError, postJson } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import styles from './EmailLoginForm.module.css';

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

// Вход по email+паролю — доступен только тем, кто уже привязал пароль
// к аккаунту через настройки (см. SetPasswordForm), будучи вошедшим
// через Discord или Telegram: отдельной регистрации "с нуля" по email
// нет осознанно (иначе было бы неясно, какие права давать такому
// аккаунту). На успехе перезагружаем страницу — дальше гейт
// (useSiteAdminGate → /api/session) сам подхватит новую сессию.
export function EmailLoginForm() {
    const [expanded, setExpanded] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    if (!expanded) {
        return (
            <button type="button" className={styles.toggle} onClick={() => setExpanded(true)}>
                Войти по email и паролю
            </button>
        );
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'loading' });
        try {
            await postJson('/auth/email/login', { email, password });
            window.location.reload();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось войти — попробуй ещё раз.';
            setStatus({ kind: 'error', message });
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}
            <TextField
                label="Email"
                id="email-login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
            />
            <TextField
                label="Пароль"
                id="email-login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
            <Button fullWidth type="submit" disabled={status.kind === 'loading'}>
                {status.kind === 'loading' ? 'Входим…' : 'Войти'}
            </Button>
        </form>
    );
}
