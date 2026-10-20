// Тонкая обёртка над stats-backend/server.js — email+пароль-аккаунты
// (RSO остаётся отдельным флоу через прямую ссылку /auth/riot/login, не
// через этот клиент, см. features/riot-sign-in/RiotSignInButton).
export class ApiError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

const ERROR_MESSAGES: Record<string, string> = {
    invalid_email: 'Enter a valid email address.',
    invalid_password: 'Password must be at least 8 characters.',
    invalid_request: 'Please fill in all fields.',
    invalid_credentials: 'Wrong email or password.',
    email_already_registered: 'An account with this email already exists — try signing in.',
    email_not_verified: "This email isn't verified yet.",
    code_not_found: 'No active code for this email — request a new one.',
    code_expired: 'This code has expired — request a new one.',
    wrong_code: 'Wrong code. Please try again.',
    too_many_attempts: 'Too many wrong attempts — request a new code.',
    code_on_cooldown: 'Please wait a bit before requesting another code.',
    internal_error: 'Something went wrong on our end — please try again.',
    unknown_location: "We don't recognize this location — check your email for a code.",
};

function messageFor(code: string): string {
    return ERROR_MESSAGES[code] ?? 'Something went wrong — please try again.';
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const code = typeof data.error === 'string' ? data.error : 'internal_error';
        throw new ApiError(code, messageFor(code));
    }
    return data as T;
}

export interface AccountUser {
    email: string;
    emailVerified: boolean;
    riotLinked: boolean;
}

export function register(email: string, password: string) {
    return postJson<{ ok: true }>('/auth/register', { email, password });
}

export function resendCode(email: string) {
    return postJson<{ ok: true }>('/auth/resend-code', { email });
}

export function verifyCode(email: string, code: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/verify', { email, code });
}

export function login(email: string, password: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login', { email, password });
}

export function resendLoginCode(email: string) {
    return postJson<{ ok: true }>('/auth/login/resend-code', { email });
}

export function confirmLoginLocation(email: string, code: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login/confirm-location', { email, code });
}

export async function getAccount(): Promise<AccountUser | null> {
    const res = await fetch('/api/account/me', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({ user: null }));
    return data.user ?? null;
}
