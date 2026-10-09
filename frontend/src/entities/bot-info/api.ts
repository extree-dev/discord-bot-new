import { getJson } from '../../shared/api/client';
import type { BotInfo } from './types';

// Публичный эндпоинт (не требует сессии) — имя и аватар бота для
// бренд-плашки "Extree" (см. shared/ui/BrandMark.tsx).
export function getBotInfo(): Promise<BotInfo> {
    return getJson<BotInfo>('/api/bot-info');
}
