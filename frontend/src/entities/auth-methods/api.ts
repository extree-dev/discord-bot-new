import { getJson } from '../../shared/api/client';
import type { AuthMethodsResponse } from './types';

// Какие способы входа включены на этом окружении — Telegram требует
// TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME на бэкенде, без них telegram
// будет null и кнопку виджета показывать не нужно.
export function getAuthMethods(): Promise<AuthMethodsResponse> {
    return getJson<AuthMethodsResponse>('/api/auth-methods');
}
