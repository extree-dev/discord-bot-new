import { useEffect, useState } from 'react';
import { getGuildChannels } from '../../entities/guild-resources/api';
import type { GuildChannel } from '../../entities/guild-resources/types';
import { getVoiceSettings } from '../../entities/voice-settings/api';
import type { VoiceSettings } from '../../entities/voice-settings/types';
import { VoiceSettingsForm } from '../../features/edit-voice-settings/VoiceSettingsForm';
import { useLang } from '../../shared/lib/useLang';
import styles from './VoiceSettingsPage.module.css';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function VoiceSettingsPage() {
    const [data, setData] = useState<{ settings: VoiceSettings; channels: GuildChannel[] } | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('voice.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
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
        <div className={styles.page}>
            <h1>{t('voice.title')}</h1>
            <p className={styles.lead}>{t('voice.lead')}</p>
            <VoiceSettingsForm initial={data.settings} channels={data.channels} />
        </div>
    );
}
