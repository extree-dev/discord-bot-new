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
    banned: 'Your account has been banned. Please contact support.', // <-- ДОБАВЛЕНО
    invalid_riot_id: 'Enter a Riot ID in the form Name#Tag.',
    riot_account_not_found: "We couldn't find a Riot account with that Riot ID.",
    riot_api_not_configured: "Riot lookup isn't configured right now — try again later.",
    riot_api_error: 'Riot is not responding right now — try again in a moment.',
    unauthorized: 'Please sign in again.',
    wrong_password: "That password doesn't look right.",
    same_email: "That's already your email.",
    no_pending_change: "There's no email change to resend a code for.",
    forbidden: "You don't have access to this.",
    ticket_not_found: "We couldn't find that ticket.",
    ticket_closed: 'This ticket is closed.',
    requires_2fa: 'Enter your 2FA code from the authenticator app.',
    csrf_failed: 'Session expired — please refresh the page.',
    weak_password: 'Password must be at least 12 characters and not contain your email or name.',
    password_breached: 'This password has appeared in a data breach — choose another one.',
    pre_2fa_expired: 'Session expired — please sign in again.',
    totp_invalid: 'Invalid 2FA code. Please try again.',
    totp_required: '2FA is not enabled for this account.',
    reset_totp_required: 'Enter your 2FA code to finish resetting your password.',
    last_admin: "Can't remove admin rights from the last remaining admin.",
};

let csrfTokenCache: string | null = null;
let csrfFetchPromise: Promise<string> | null = null;

/** Один раз тянем /api/csrf-token, дальше кешируем в памяти. */
async function getCsrfToken(): Promise<string> {
    if (csrfTokenCache) return csrfTokenCache;
    if (!csrfFetchPromise) {
        csrfFetchPromise = (async () => {
            const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            const token = typeof data.csrfToken === 'string' ? data.csrfToken : '';
            if (token) csrfTokenCache = token;
            return token;
        })().finally(() => {
            csrfFetchPromise = null;
        });
    }
    return csrfFetchPromise!;
}

/** Сбросить кеш (при 403 csrf_failed — перезапросить). */
function resetCsrfToken() {
    csrfTokenCache = null;
}

function messageFor(code: string): string {
    return ERROR_MESSAGES[code] ?? 'Something went wrong — please try again.';
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const csrf = await getCsrfToken();
    let res = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    if (res.status === 403) {
        const first = await res
            .clone()
            .json()
            .catch(() => ({}));
        if (first.error === 'csrf_failed') {
            resetCsrfToken();
            const fresh = await getCsrfToken();
            res = await fetch(path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(fresh ? { 'X-CSRF-Token': fresh } : {}),
                },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });
        }
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const code = typeof data.error === 'string' ? data.error : 'internal_error';
        throw new ApiError(code, messageFor(code));
    }
    return data as T;
}

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(path, { credentials: 'same-origin' });
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
    isAdmin: boolean;
    avatarUrl: string | null;
    isVerified: boolean;
    isTwoFactorEnabled: boolean;
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

export function login(email: string, password: string, turnstileToken: string, rememberMe: boolean = true) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login', {
        email,
        password,
        turnstileToken,
        rememberMe,
    });
}

export function verify2fa(email: string, code: string, rememberMe: boolean = true) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/login/verify-2fa', { email, code, rememberMe });
}

export function setup2fa(password: string) {
    return postJson<{ secret: string; otpauthUrl: string; recoveryCodes: string[] }>('/api/account/2fa/setup', {
        password,
    });
}

export function enable2fa(code: string, password: string) {
    return postJson<{ ok: true }>('/api/account/2fa/enable', { code, password });
}

export function disable2fa(password: string) {
    return postJson<{ ok: true }>('/api/account/2fa/disable', { password });
}

export function regenerateRecoveryCodes(password: string) {
    return postJson<{ recoveryCodes: string[] }>('/api/account/2fa/recovery-codes', { password });
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

export function resetPassword(token: string, password: string, totpCode?: string) {
    return postJson<{ ok: true; user: { email: string } }>('/auth/reset-password', { token, password, totpCode });
}

export function submitSupportTicket(subject: string, message: string, category: string, email?: string) {
    return postJson<{ ok: true; ticketNumber: number }>('/api/support/tickets', { subject, message, category, email });
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

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const csrf = await getCsrfToken();
    const res = await fetch('/api/account/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });

    if (!res.ok) {
        throw new ApiError('upload_failed', 'Не удалось загрузить аватар');
    }
    return res.json();
}

export interface AccountState {
    user: AccountUser | null;
    banned: boolean;
}

export async function getAccount(): Promise<AccountState> {
    const res = await fetch('/api/account/me', { credentials: 'include' });
    const data = await res.json().catch(() => ({ user: null, banned: false }));
    return { user: data.user ?? null, banned: data.banned === true };
}

export interface LoginEvent {
    id: string;
    ip: string | null;
    country: string | null;
    city: string | null;
    time: string;
    device: string;
}

export async function getLoginHistory(): Promise<LoginEvent[]> {
    const res = await fetch('/api/account/login-history', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({ events: [] }));
    return data.events ?? [];
}

export type TicketStatus = 'open' | 'in_progress' | 'closed';

export interface TicketSummary {
    number: number;
    email: string;
    subject: string;
    category: string;
    status: TicketStatus;
    time: string;
}

export interface TicketReply {
    id: string;
    author: 'user' | 'admin';
    message: string;
    time: string;
}

export interface TicketDetail {
    number: number;
    subject: string;
    message: string;
    status: TicketStatus;
    time: string;
}

export interface AdminTicketDetail extends TicketDetail {
    email: string;
    category: string;
    userId: string | null;
    isUserVerified: boolean;
}

export function getAdminTickets(status?: TicketStatus) {
    const query = status ? `?status=${status}` : '';
    return getJson<{ tickets: TicketSummary[] }>(`/api/admin/tickets${query}`);
}

export function getAdminTicket(number: number | string) {
    return getJson<{ ticket: AdminTicketDetail; replies: TicketReply[] }>(`/api/admin/tickets/${number}`);
}

export function replyToTicketAsAdmin(number: number | string, message: string) {
    return postJson<{ ok: true }>(`/api/admin/tickets/${number}/reply`, { message });
}

export function setTicketStatus(number: number | string, status: TicketStatus) {
    return postJson<{ ok: true }>(`/api/admin/tickets/${number}/status`, { status });
}

export interface CannedResponse {
    id: string;
    title: string;
    body: string;
}

export function getCannedResponses() {
    return getJson<{ responses: CannedResponse[] }>('/api/admin/canned-responses');
}

export function createCannedResponse(title: string, body: string) {
    return postJson<{ ok: true; id: string }>('/api/admin/canned-responses', { title, body });
}

export async function deleteCannedResponse(id: string): Promise<void> {
    const csrf = await getCsrfToken();
    const res = await fetch(`/api/admin/canned-responses/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = typeof data.error === 'string' ? data.error : 'internal_error';
        throw new ApiError(code, messageFor(code));
    }
}

export function getTicketByToken(token: string) {
    return getJson<{ ticket: TicketDetail; replies: TicketReply[] }>(`/api/support/tickets/${token}`);
}

export function replyToTicket(token: string, message: string) {
    return postJson<{ ok: true }>(`/api/support/tickets/${token}/reply`, { message });
}

// --- АУДИТ ---

export interface AuditEntry {
    id: number;
    adminId: string;
    adminEmail: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: string | null;
    ip: string | null;
    createdAt: string;
}

export function getAdminAudit(limit: number = 50, offset: number = 0) {
    return getJson<{ entries: AuditEntry[] }>(`/api/admin/audit?limit=${limit}&offset=${offset}`);
}

// --- АДМИНКА ПОЛЬЗОВАТЕЛЕЙ ---

export interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    isBanned: boolean;
    isAdmin: boolean;
}

export function getAllUsers() {
    return getJson<{ users: AdminUser[] }>('/api/admin/users');
}

export function banUser(userId: string, isBanned: boolean) {
    return postJson<{ ok: true }>(`/api/admin/users/${userId}/ban?isBanned=${isBanned}`, {});
}

export function verifyUser(userId: string, isVerified: boolean) {
    return postJson<{ ok: true }>(`/api/admin/users/${userId}/verify?isVerified=${isVerified}`, {});
}

export function makeAdmin(userId: string, isAdmin: boolean) {
    return postJson<{ ok: true }>(`/api/admin/users/${userId}/make-admin?isAdmin=${isAdmin}`, {});
}

// Удаляет запись из истории входов И отзывает привязанную к ней сессию на
// сервере (см. LoginEventController/SessionRepository, Java) — устройство
// реально разлогинивается, не только пропадает из списка.
export function revokeSession(id: string) {
    return postJson<{ ok: true }>(`/api/account/logout-session/${id}`, {});
}

// --- GLOBAL SEARCH (Cmd+K) ---

export interface GlobalSearchResult {
    tickets: { number: number; email: string; subject: string; status: string }[];
    users: { id: string; email: string; name: string; nickname: string }[];
}

export function globalSearch(q: string) {
    return getJson<GlobalSearchResult>(`/api/admin/search?q=${encodeURIComponent(q)}`);
}
