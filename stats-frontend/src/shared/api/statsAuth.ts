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
    invalid_password: 'Password must be at least 8 characters, with a letter and a number.',
    invalid_name: 'Enter your name.',
    invalid_nickname: 'Nickname must be 3-24 characters: letters, numbers, underscore.',
    invalid_subject: 'Enter a subject.',
    invalid_message: 'Enter a message (up to 5000 characters).',
    invalid_category: 'Choose a category.',
    invalid_request: 'Please fill in all fields.',
    invalid_credentials: 'Wrong email or password.',
    email_already_registered: 'An account with this email already exists — try signing in.',
    email_not_verified: "This email isn't verified yet.",
    nickname_taken: 'That nickname is already taken — try another.',
    code_not_found: 'No active code for this email — request a new one.',
    code_expired: 'This code has expired — request a new one.',
    wrong_code: 'Wrong code. Please try again.',
    too_many_attempts: 'Too many wrong attempts — request a new code.',
    code_on_cooldown: 'Please wait a bit before requesting another code.',
    internal_error: 'Something went wrong on our end — please try again.',
    unknown_location: "We don't recognize this location — check your email for a code.",
    token_not_found: 'This reset link is invalid — request a new one.',
    token_expired: 'This reset link has expired — request a new one.',
    turnstile_failed: 'Verification failed — please try again.',
    invalid_riot_id: 'Enter a Riot ID in the form Name#Tag.',
    riot_account_not_found: "We couldn't find a Riot account with that Riot ID.",
    riot_api_not_configured: "Riot lookup isn't configured right now — try again later.",
    riot_api_error: 'Riot is not responding right now — try again in a moment.',
    unauthorized: 'Please sign in again.',
    wrong_password: "That password doesn't look right.",
    same_email: "That's already your email.",
    no_pending_change: "There's no email change to resend a code for.",
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
    name: string | null;
    nickname: string | null;
}

export function register(email: string, password: string, name: string, nickname: string) {
    return postJson<{ ok: true }>('/auth/register', { email, password, name, nickname });
}

export function resendCode(email: string) {
    return postJson<{ ok: true }>('/auth/resend-code', { email });
}

export function verifyCode(email: string, code: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/verify', { email, code });
}

export function login(email: string, password: string, turnstileToken: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login', { email, password, turnstileToken });
}

export function resendLoginCode(email: string) {
    return postJson<{ ok: true }>('/auth/login/resend-code', { email });
}

export function confirmLoginLocation(email: string, code: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login/confirm-location', { email, code });
}

export function forgotPassword(email: string) {
    return postJson<{ ok: true }>('/auth/forgot-password', { email });
}

export function resetPassword(token: string, password: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/reset-password', { token, password });
}

export function submitSupportTicket(subject: string, message: string, category: string, email?: string) {
    return postJson<{ ok: true; ticketId: string }>('/api/support/tickets', { subject, message, category, email });
}

export function lookupRiotId(riotId: string) {
    return postJson<{ ok: true; gameName: string; tagLine: string }>('/api/riot/lookup', { riotId });
}

export function requestEmailChange(currentPassword: string, newEmail: string) {
    return postJson<{ ok: true }>('/auth/account/change-email', { currentPassword, newEmail });
}

export function resendEmailChangeCode() {
    return postJson<{ ok: true }>('/auth/account/resend-email-change-code', {});
}

export function confirmEmailChange(code: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/account/confirm-email-change', { code });
}

export function changePassword(currentPassword: string, newPassword: string) {
    return postJson<{ ok: true }>('/auth/account/change-password', { currentPassword, newPassword });
}

export async function getAccount(): Promise<AccountUser | null> {
    const res = await fetch('/api/account/me', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({ user: null }));
    return data.user ?? null;
}
