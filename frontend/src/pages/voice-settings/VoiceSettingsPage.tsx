import { useEffect, useState } from 'react';
import { getGuildChannels } from '../../entities/guild-resources/api';
import type { GuildChannel } from '../../entities/guild-resources/types';
import { getVoiceSettings } from '../../entities/voice-settings/api';
import type { VoiceSettings } from '../../entities/voice-settings/types';
import { VoiceSettingsForm } from '../../features/edit-voice-settings/VoiceSettingsForm';
import { Card } from '../../shared/ui/Card';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function VoiceSettingsPage() {
    const [data, setData] = useState<{ settings: VoiceSettings; channels: GuildChannel[] } | null>(null);

    useEffect(() => {
        document.title = 'Голосовые комнаты — Extree';
        let cancelled = false;
        Promise.all([getVoiceSettings(), getGuildChannels()]).then(([settings, { channels }]) => {
            if (!cancelled) setData({ settings, channels });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!data) return null;

    return (
        <Card wide>
            <h1>Голосовые комнаты</h1>
            <p>Триггер-канал, категории и лимит участников по умолчанию — те же каналы сервера, выбор из списка.</p>
            <VoiceSettingsForm initial={data.settings} channels={data.channels} />
        </Card>
    );
}
