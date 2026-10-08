import { useState } from 'react';
import { updatePresenceSettings } from '../../entities/presence-settings/api';
import type { ActivityItem, PresenceSettings } from '../../entities/presence-settings/types';
import { ApiError } from '../../shared/api/client';
import { useLang } from '../../shared/lib/useLang';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Checkbox } from '../../shared/ui/Checkbox';
import { SelectField, TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import {
    ACTIVITY_TYPE_OPTIONS,
    STATUS_OPTIONS,
    addRotateItem,
    minutesToMs,
    msToMinutes,
    removeRotateItem,
    toPayload,
    updateRotateItem,
} from './model';
import styles from './PresenceSettingsForm.module.css';

interface PresenceSettingsFormProps {
    initial: PresenceSettings;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

function ActivityFields({
    item,
    idPrefix,
    onChange,
    t,
}: {
    item: ActivityItem;
    idPrefix: string;
    onChange: (patch: Partial<ActivityItem>) => void;
    t: ReturnType<typeof useLang>['t'];
}) {
    return (
        <div className={styles.activityRow}>
            <SelectField
                label={t('status.type')}
                id={`${idPrefix}-type`}
                options={ACTIVITY_TYPE_OPTIONS}
                value={item.type}
                onChange={e => onChange({ type: e.target.value as ActivityItem['type'] })}
            />
            <TextField
                label={t('status.text')}
                id={`${idPrefix}-text`}
                value={item.text ?? ''}
                maxLength={128}
                onChange={e => onChange({ text: e.target.value })}
            />
            {item.type === 'streaming' && (
                <TextField
                    label={t('status.streamUrl')}
                    id={`${idPrefix}-url`}
                    placeholder="https://twitch.tv/канал"
                    value={item.url ?? ''}
                    onChange={e => onChange({ url: e.target.value })}
                />
            )}
        </div>
    );
}

// Та же замена плоских секций на стеклянные карточки, что в
// SecuritySettingsForm — см. комментарий там.
export function PresenceSettingsForm({ initial }: PresenceSettingsFormProps) {
    const [settings, setSettings] = useState<PresenceSettings>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const { t } = useLang();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'saving' });
        try {
            const saved = await updatePresenceSettings(toPayload(settings));
            setSettings(saved);
            setStatus({ kind: 'saved' });
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось сохранить — попробуй ещё раз.';
            setStatus({ kind: 'error', message });
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {status.kind === 'saved' && <Notice variant="info">{t('status.saved')}</Notice>}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}

            <Card wide className={styles.section}>
                <h2>{t('status.onlineStatus')}</h2>
                <SelectField
                    label={t('status.statusLabel')}
                    id="presence-status"
                    options={STATUS_OPTIONS}
                    value={settings.status}
                    onChange={e => setSettings({ ...settings, status: e.target.value as PresenceSettings['status'] })}
                />
            </Card>

            <Card wide className={styles.section}>
                <h2>{t('status.rotation')}</h2>
                <Checkbox
                    label={t('status.rotationToggle')}
                    id="presence-rotate"
                    checked={settings.rotate}
                    onChange={e => setSettings({ ...settings, rotate: e.target.checked })}
                />
                {settings.rotate && (
                    <TextField
                        label={t('status.intervalMinutes')}
                        id="presence-interval"
                        type="number"
                        min={1}
                        max={1440}
                        value={msToMinutes(settings.rotateIntervalMs)}
                        onChange={e =>
                            setSettings({ ...settings, rotateIntervalMs: minutesToMs(Number(e.target.value)) })
                        }
                    />
                )}
            </Card>

            {settings.rotate ? (
                <Card wide className={styles.section}>
                    <h2>{t('status.rotateItemsTitle')}</h2>
                    {settings.rotateItems.map((item, index) => (
                        <div className={styles.rotateItem} key={index}>
                            <ActivityFields
                                item={item}
                                idPrefix={`rotate-${index}`}
                                t={t}
                                onChange={patch =>
                                    setSettings({
                                        ...settings,
                                        rotateItems: updateRotateItem(settings.rotateItems, index, patch),
                                    })
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                    setSettings({
                                        ...settings,
                                        rotateItems: removeRotateItem(settings.rotateItems, index),
                                    })
                                }
                            >
                                {t('status.remove')}
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSettings({ ...settings, rotateItems: addRotateItem(settings.rotateItems) })}
                    >
                        + {t('status.addActivity')}
                    </Button>
                </Card>
            ) : (
                <Card wide className={styles.section}>
                    <h2>{t('status.fixedStatus')}</h2>
                    <ActivityFields
                        item={settings.activity}
                        idPrefix="activity"
                        t={t}
                        onChange={patch => setSettings({ ...settings, activity: { ...settings.activity, ...patch } })}
                    />
                </Card>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? t('status.saving') : t('status.save')}
            </Button>
        </form>
    );
}
