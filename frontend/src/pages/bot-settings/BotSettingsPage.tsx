import { useEffect, useState } from 'react';
import { getSecuritySettings } from '../../entities/security-settings/api';
import type { SecuritySettings } from '../../entities/security-settings/types';
import { SecuritySettingsForm } from '../../features/edit-security-settings/SecuritySettingsForm';
import { Card } from '../../shared/ui/Card';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function BotSettingsPage() {
    const [settings, setSettings] = useState<SecuritySettings | null>(null);

    useEffect(() => {
        document.title = 'Безопасность — Extree';
        let cancelled = false;
        getSecuritySettings().then(s => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!settings) return null;

    return (
        <Card wide>
            <h1>Безопасность</h1>
            <p>
                Та же конфигурация, что команды вроде <code>/automod</code> в Discord — правки применяются сразу.
            </p>
            <SecuritySettingsForm initial={settings} />
        </Card>
    );
}
