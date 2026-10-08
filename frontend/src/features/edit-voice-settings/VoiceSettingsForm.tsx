import { useState } from 'react';
import type { GuildChannel } from '../../entities/guild-resources/types';
import { updateVoiceSettings } from '../../entities/voice-settings/api';
import type { VoiceSettings } from '../../entities/voice-settings/types';
import { ApiError } from '../../shared/api/client';
import { useLang } from '../../shared/lib/useLang';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { SelectField, TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { CHANNEL_TYPE, toChannelOptions, toPayload } from './model';
import styles from './VoiceSettingsForm.module.css';

interface VoiceSettingsFormProps {
    initial: VoiceSettings;
    channels: GuildChannel[];
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

// Та же замена плоских секций на стеклянные карточки, что в
// SecuritySettingsForm/PresenceSettingsForm — см. комментарий там.
export function VoiceSettingsForm({ initial, channels }: VoiceSettingsFormProps) {
    const [settings, setSettings] = useState<VoiceSettings>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const { t } = useLang();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'saving' });
        try {
            const saved = await updateVoiceSettings(toPayload(settings));
            setSettings(saved);
            setStatus({ kind: 'saved' });
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось сохранить — попробуй ещё раз.';
            setStatus({ kind: 'error', message });
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {status.kind === 'saved' && <Notice variant="info">{t('voice.saved')}</Notice>}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}

            <Card wide className={styles.section}>
                <h2>{t('voice.channelsSection')}</h2>
                <SelectField
                    label={t('voice.triggerChannel')}
                    id="voice-trigger"
                    options={toChannelOptions(channels, CHANNEL_TYPE.voice)}
                    value={settings.triggerChannelId ?? ''}
                    onChange={e => setSettings({ ...settings, triggerChannelId: e.target.value || null })}
                />
                <SelectField
                    label={t('voice.controlChannel')}
                    id="voice-control"
                    options={toChannelOptions(channels, CHANNEL_TYPE.text)}
                    value={settings.controlChannelId ?? ''}
                    onChange={e => setSettings({ ...settings, controlChannelId: e.target.value || null })}
                />
                <SelectField
                    label={t('voice.category')}
                    id="voice-category"
                    options={toChannelOptions(channels, CHANNEL_TYPE.category)}
                    value={settings.categoryId ?? ''}
                    onChange={e => setSettings({ ...settings, categoryId: e.target.value || null })}
                />
                <SelectField
                    label={t('voice.roomsCategory')}
                    id="voice-rooms-category"
                    options={toChannelOptions(channels, CHANNEL_TYPE.category)}
                    value={settings.roomsCategoryId ?? ''}
                    onChange={e => setSettings({ ...settings, roomsCategoryId: e.target.value || null })}
                />
            </Card>

            <Card wide className={styles.section}>
                <h2>{t('voice.defaultsSection')}</h2>
                <TextField
                    label={t('voice.defaultLimit')}
                    id="voice-default-limit"
                    type="number"
                    min={0}
                    max={99}
                    value={settings.defaultLimit}
                    onChange={e => setSettings({ ...settings, defaultLimit: Number(e.target.value) })}
                />
            </Card>

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? t('voice.saving') : t('voice.save')}
            </Button>
        </form>
    );
}
