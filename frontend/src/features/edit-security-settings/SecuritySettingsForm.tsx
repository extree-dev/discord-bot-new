import { useState } from 'react';
import { updateSecuritySettings } from '../../entities/security-settings/api';
import type { SecuritySettings } from '../../entities/security-settings/types';
import { ApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Checkbox';
import { TextArea, TextField } from '../../shared/ui/Field';
import { formatList, parseList, toPayload } from './model';
import styles from './SecuritySettingsForm.module.css';

interface SecuritySettingsFormProps {
    initial: SecuritySettings;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

function toNumber(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function SecuritySettingsForm({ initial }: SecuritySettingsFormProps) {
    const [settings, setSettings] = useState<SecuritySettings>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'saving' });
        try {
            const saved = await updateSecuritySettings(toPayload(settings));
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
                <p className={styles.notice}>Сохранено — применяется сразу, без перезапуска бота.</p>
            )}
            {status.kind === 'error' && <p className={styles.error}>{status.message}</p>}

            <section className={styles.section}>
                <h2>Automod</h2>
                <Checkbox
                    label="Включён"
                    id="automod-enabled"
                    checked={settings.automod.enabled}
                    onChange={e =>
                        setSettings({ ...settings, automod: { ...settings.automod, enabled: e.target.checked } })
                    }
                />
                <div className={styles.row}>
                    <TextField
                        label="Макс. упоминаний в сообщении"
                        id="automod-maxMentions"
                        type="number"
                        min={0}
                        value={settings.automod.maxMentions}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                automod: { ...settings.automod, maxMentions: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Макс. сообщений в окне"
                        id="automod-maxMessagesPerWindow"
                        type="number"
                        min={0}
                        value={settings.automod.maxMessagesPerWindow}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                automod: { ...settings.automod, maxMessagesPerWindow: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Окно антиспама, мс"
                        id="automod-messageWindowMs"
                        type="number"
                        min={0}
                        value={settings.automod.messageWindowMs}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                automod: { ...settings.automod, messageWindowMs: toNumber(e.target.value) },
                            })
                        }
                    />
                </div>
                <TextArea
                    label="Разрешённые коды приглашений (по одному на строку, не домены)"
                    id="automod-allowedInviteCodes"
                    rows={3}
                    value={formatList(settings.automod.allowedInviteCodes)}
                    onChange={e =>
                        setSettings({
                            ...settings,
                            automod: { ...settings.automod, allowedInviteCodes: parseList(e.target.value) },
                        })
                    }
                />
            </section>

            <section className={styles.section}>
                <h2>Raid Shield</h2>
                <Checkbox
                    label="Включён"
                    id="raidShield-enabled"
                    checked={settings.raidShield.enabled}
                    onChange={e =>
                        setSettings({ ...settings, raidShield: { ...settings.raidShield, enabled: e.target.checked } })
                    }
                />
                <Checkbox
                    label="Кикать новые аккаунты при рейде"
                    id="raidShield-kickNewAccounts"
                    checked={settings.raidShield.kickNewAccounts}
                    onChange={e =>
                        setSettings({
                            ...settings,
                            raidShield: { ...settings.raidShield, kickNewAccounts: e.target.checked },
                        })
                    }
                />
                <div className={styles.row}>
                    <TextField
                        label="Порог входов для тревоги"
                        id="raidShield-joinThreshold"
                        type="number"
                        min={0}
                        value={settings.raidShield.joinThreshold}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                raidShield: { ...settings.raidShield, joinThreshold: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Окно отслеживания, мс"
                        id="raidShield-windowMs"
                        type="number"
                        min={0}
                        value={settings.raidShield.windowMs}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                raidShield: { ...settings.raidShield, windowMs: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Длительность lockdown, мс"
                        id="raidShield-lockdownMs"
                        type="number"
                        min={0}
                        value={settings.raidShield.lockdownMs}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                raidShield: { ...settings.raidShield, lockdownMs: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Мин. возраст аккаунта, мс"
                        id="raidShield-newAccountAgeMs"
                        type="number"
                        min={0}
                        value={settings.raidShield.newAccountAgeMs}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                raidShield: { ...settings.raidShield, newAccountAgeMs: toNumber(e.target.value) },
                            })
                        }
                    />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Anti-Nuke</h2>
                <Checkbox
                    label="Включён"
                    id="antiNuke-enabled"
                    checked={settings.antiNuke.enabled}
                    onChange={e =>
                        setSettings({ ...settings, antiNuke: { ...settings.antiNuke, enabled: e.target.checked } })
                    }
                />
                <div className={styles.row}>
                    <TextField
                        label="Макс. опасных действий"
                        id="antiNuke-maxActions"
                        type="number"
                        min={0}
                        value={settings.antiNuke.maxActions}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                antiNuke: { ...settings.antiNuke, maxActions: toNumber(e.target.value) },
                            })
                        }
                    />
                    <TextField
                        label="Окно отслеживания, мс"
                        id="antiNuke-windowMs"
                        type="number"
                        min={0}
                        value={settings.antiNuke.windowMs}
                        onChange={e =>
                            setSettings({
                                ...settings,
                                antiNuke: { ...settings.antiNuke, windowMs: toNumber(e.target.value) },
                            })
                        }
                    />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Бан-слова</h2>
                <TextArea
                    label="По одному слову/фразе на строку"
                    id="bannedWords"
                    rows={4}
                    value={formatList(settings.bannedWords)}
                    onChange={e => setSettings({ ...settings, bannedWords: parseList(e.target.value) })}
                />
            </section>

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? 'Сохраняю…' : 'Сохранить'}
            </Button>
        </form>
    );
}
