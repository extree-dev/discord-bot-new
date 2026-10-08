import { useState } from 'react';
import { updateSecuritySettings } from '../../entities/security-settings/api';
import type { SecuritySettings } from '../../entities/security-settings/types';
import { ApiError } from '../../shared/api/client';
import { useLang } from '../../shared/lib/useLang';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Checkbox } from '../../shared/ui/Checkbox';
import { TextArea, TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
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

// Каждый модуль безопасности — отдельная стеклянная карточка (Card из
// shared/ui, та же поверхность, что везде в кабинете) с бейджем
// включён/выключен в заголовке — раньше все три модуля шли плоскими
// секциями с хардкодным rgba-фоном внутри одной большой карты, из-за чего
// в светлой теме фон секции был почти не виден ("квадратики"); теперь
// фон — var(--glass-bg) с реальным blur, виден в обеих темах одинаково.
export function SecuritySettingsForm({ initial }: SecuritySettingsFormProps) {
    const [settings, setSettings] = useState<SecuritySettings>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const { t } = useLang();

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
            {status.kind === 'saved' && <Notice variant="info">{t('security.saved')}</Notice>}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}

            <Card wide className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>{t('security.automod')}</h2>
                    <Badge variant={settings.automod.enabled ? 'success' : 'neutral'}>
                        {settings.automod.enabled ? t('security.enabled') : '—'}
                    </Badge>
                </div>
                <Checkbox
                    label={t('security.enabled')}
                    id="automod-enabled"
                    checked={settings.automod.enabled}
                    onChange={e =>
                        setSettings({ ...settings, automod: { ...settings.automod, enabled: e.target.checked } })
                    }
                />
                <div className={styles.row}>
                    <TextField
                        label={t('security.maxMentions')}
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
                        label={t('security.maxMessages')}
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
                        label={t('security.antiSpamWindow')}
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
                    label={t('security.allowedInvites')}
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
            </Card>

            <Card wide className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>{t('security.raidShield')}</h2>
                    <Badge variant={settings.raidShield.enabled ? 'success' : 'neutral'}>
                        {settings.raidShield.enabled ? t('security.enabled') : '—'}
                    </Badge>
                </div>
                <Checkbox
                    label={t('security.enabled')}
                    id="raidShield-enabled"
                    checked={settings.raidShield.enabled}
                    onChange={e =>
                        setSettings({ ...settings, raidShield: { ...settings.raidShield, enabled: e.target.checked } })
                    }
                />
                <Checkbox
                    label={t('security.kickNewAccounts')}
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
                        label={t('security.joinThreshold')}
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
                        label={t('security.trackingWindow')}
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
                        label={t('security.lockdownDuration')}
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
                        label={t('security.minAccountAge')}
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
            </Card>

            <Card wide className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>{t('security.antiNuke')}</h2>
                    <Badge variant={settings.antiNuke.enabled ? 'success' : 'neutral'}>
                        {settings.antiNuke.enabled ? t('security.enabled') : '—'}
                    </Badge>
                </div>
                <Checkbox
                    label={t('security.enabled')}
                    id="antiNuke-enabled"
                    checked={settings.antiNuke.enabled}
                    onChange={e =>
                        setSettings({ ...settings, antiNuke: { ...settings.antiNuke, enabled: e.target.checked } })
                    }
                />
                <div className={styles.row}>
                    <TextField
                        label={t('security.maxDangerousActions')}
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
                        label={t('security.trackingWindow')}
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
            </Card>

            <Card wide className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>{t('security.bannedWords')}</h2>
                </div>
                <TextArea
                    label={t('security.bannedWordsHint')}
                    id="bannedWords"
                    rows={4}
                    value={formatList(settings.bannedWords)}
                    onChange={e => setSettings({ ...settings, bannedWords: parseList(e.target.value) })}
                />
            </Card>

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? t('security.saving') : t('security.save')}
            </Button>
        </form>
    );
}
