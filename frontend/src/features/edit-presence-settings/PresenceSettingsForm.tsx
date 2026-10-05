import { useState } from 'react';
import { updatePresenceSettings } from '../../entities/presence-settings/api';
import type { ActivityItem, PresenceSettings } from '../../entities/presence-settings/types';
import { ApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
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
}: {
    item: ActivityItem;
    idPrefix: string;
    onChange: (patch: Partial<ActivityItem>) => void;
}) {
    return (
        <div className={styles.activityRow}>
            <SelectField
                label="Тип"
                id={`${idPrefix}-type`}
                options={ACTIVITY_TYPE_OPTIONS}
                value={item.type}
                onChange={e => onChange({ type: e.target.value as ActivityItem['type'] })}
            />
            <TextField
                label="Текст (можно {members} и {uptime})"
                id={`${idPrefix}-text`}
                value={item.text ?? ''}
                maxLength={128}
                onChange={e => onChange({ text: e.target.value })}
            />
            {item.type === 'streaming' && (
                <TextField
                    label="Ссылка на трансляцию"
                    id={`${idPrefix}-url`}
                    placeholder="https://twitch.tv/канал"
                    value={item.url ?? ''}
                    onChange={e => onChange({ url: e.target.value })}
                />
            )}
        </div>
    );
}

export function PresenceSettingsForm({ initial }: PresenceSettingsFormProps) {
    const [settings, setSettings] = useState<PresenceSettings>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

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
            {status.kind === 'saved' && (
                <Notice variant="info">Сохранено — применится в течение ~30 секунд, без перезапуска бота.</Notice>
            )}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}

            <section className={styles.section}>
                <h2>Онлайн-статус</h2>
                <SelectField
                    label="Статус"
                    id="presence-status"
                    options={STATUS_OPTIONS}
                    value={settings.status}
                    onChange={e => setSettings({ ...settings, status: e.target.value as PresenceSettings['status'] })}
                />
            </section>

            <section className={styles.section}>
                <h2>Ротация</h2>
                <Checkbox
                    label="Крутить несколько статусов по очереди"
                    id="presence-rotate"
                    checked={settings.rotate}
                    onChange={e => setSettings({ ...settings, rotate: e.target.checked })}
                />
                {settings.rotate && (
                    <TextField
                        label="Интервал смены, минут"
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
            </section>

            {settings.rotate ? (
                <section className={styles.section}>
                    <h2>Пункты ротации</h2>
                    {settings.rotateItems.map((item, index) => (
                        <div className={styles.rotateItem} key={index}>
                            <ActivityFields
                                item={item}
                                idPrefix={`rotate-${index}`}
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
                                Удалить пункт
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSettings({ ...settings, rotateItems: addRotateItem(settings.rotateItems) })}
                    >
                        + Добавить пункт
                    </Button>
                </section>
            ) : (
                <section className={styles.section}>
                    <h2>Фиксированный статус</h2>
                    <ActivityFields
                        item={settings.activity}
                        idPrefix="activity"
                        onChange={patch => setSettings({ ...settings, activity: { ...settings.activity, ...patch } })}
                    />
                </section>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? 'Сохраняю…' : 'Сохранить'}
            </Button>
        </form>
    );
}
