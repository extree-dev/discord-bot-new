import { useEffect, useState } from 'react';
import { getSecuritySettings } from '../../entities/security-settings/api';
import type { SecuritySettings } from '../../entities/security-settings/types';
import { SecuritySettingsForm } from '../../features/edit-security-settings/SecuritySettingsForm';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { Card } from '../../shared/ui/Card';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';

export function BotSettingsPage() {
    const gate = useSiteAdminGate();
    const [settings, setSettings] = useState<SecuritySettings | null>(null);

    useEffect(() => {
        document.title = 'Настройки бота — Extree';
    }, []);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        getSecuritySettings().then(s => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, [gate]);

    if (gate === 'loading') return null;

    if (gate === 'logged-out') {
        return (
            <Card>
                <h1>Настройки бота</h1>
                <p>Войди через Discord — управлять настройками может только администратор сервера бота.</p>
                <LoginButton />
            </Card>
        );
    }

    if (gate === 'denied') {
        return (
            <Card>
                <h1>Нет доступа</h1>
                <p>Управлять настройками может только администратор сервера, на котором работает бот.</p>
                <LogoutButton />
            </Card>
        );
    }

    if (!settings) return null;

    return (
        <Card wide>
            <h1>Настройки бота</h1>
            <p>
                Та же конфигурация, что команды вроде <code>/automod</code> в Discord — правки применяются сразу. Пока
                здесь только безопасность (automod, raid shield, anti-nuke, бан-слова); остальные модули появятся
                следующими.
            </p>
            <SecuritySettingsForm initial={settings} />
            <LogoutButton />
        </Card>
    );
}
