import { getJson } from '../../shared/api/client';
import type { SessionResponse } from './types';

// user: null, а не 401 — "не вошёл" это не ошибка API, а обычное
// состояние, которое проверяют все три страницы (визитка не проверяет
// вообще, /admin и /dashboard — проверяют).
export function getSession(): Promise<SessionResponse> {
    return getJson<SessionResponse>('/api/session');
}
