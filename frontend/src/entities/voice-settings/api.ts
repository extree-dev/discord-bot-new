import { getJson, putJson } from '../../shared/api/client';
import type { VoiceSettings } from './types';

export function getVoiceSettings(): Promise<VoiceSettings> {
    return getJson<VoiceSettings>('/api/voice-settings');
}

export function updateVoiceSettings(settings: VoiceSettings): Promise<VoiceSettings> {
    return putJson<VoiceSettings>('/api/voice-settings', settings);
}
