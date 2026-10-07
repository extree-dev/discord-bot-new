import { getJson, postJson } from '../../shared/api/client';
import type { LinkedAccounts } from './types';

export function getLinkedAccounts(): Promise<LinkedAccounts> {
    return getJson<LinkedAccounts>('/api/linked-accounts');
}

// Привязка email+пароля к уже вошедшему аккаунту (Discord/Telegram) —
// не самостоятельная регистрация, см. dashboard/server.js
// POST /auth/email/set-password.
export function setEmailPassword(email: string, password: string): Promise<{ ok: true }> {
    return postJson<{ ok: true }>('/auth/email/set-password', { email, password });
}
