import { useState } from 'react';
import { setEmailPassword } from '../../entities/linked-accounts/api';
import { ApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import styles from './EmailLoginForm.module.css';

interface SetPasswordFormProps {
    currentEmail: string | null;
    onLinked: (email: string) => void;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

// Привязка email+пароля к уже вошедшему аккаунту — требует активной
// сессии (Discord/Telegram), это не самостоятельная регистрация.
// После привязки этим email+паролем можно будет входить напрямую, без
// Discord/Telegram, см. features/email-auth/EmailLoginForm.
export function SetPasswordForm({ currentEmail, onLinked }: SetPasswordFormProps) {
    const [email, setEmail] = useState(currentEmail ?? '');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'saving' });
        try {
            await setEmailPassword(email, password);
            setPassword('');
            setStatus({ kind: 'saved' });
            onLinked(email);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось сохранить — попробуй ещё раз.';
            setStatus({ kind: 'error', message });
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {status.kind === 'saved' && <Notice variant="info">Email и пароль сохранены.</Notice>}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}
            <TextField
                label="Email"
                id="set-password-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
            />
            <TextField
                label="Новый пароль (не короче 8 символов)"
                id="set-password-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? 'Сохраняем…' : currentEmail ? 'Обновить пароль' : 'Включить вход по email'}
            </Button>
        </form>
    );
}
