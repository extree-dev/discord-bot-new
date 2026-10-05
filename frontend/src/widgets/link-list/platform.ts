export type Platform = 'discord' | 'telegram' | 'instagram' | 'twitter' | 'youtube' | 'github' | 'generic';

const HOST_RULES: Array<{ platform: Platform; hosts: string[] }> = [
    { platform: 'discord', hosts: ['discord.com', 'discord.gg'] },
    { platform: 'telegram', hosts: ['t.me', 'telegram.me', 'telegram.org'] },
    { platform: 'instagram', hosts: ['instagram.com'] },
    { platform: 'twitter', hosts: ['twitter.com', 'x.com'] },
    { platform: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
    { platform: 'github', hosts: ['github.com'] },
];

const LABEL_RULES: Array<{ platform: Platform; keywords: string[] }> = [
    { platform: 'discord', keywords: ['discord'] },
    { platform: 'telegram', keywords: ['telegram', 'телеграм'] },
    { platform: 'instagram', keywords: ['instagram', 'инстаграм'] },
    { platform: 'twitter', keywords: ['twitter', 'x.com', ' x '] },
    { platform: 'youtube', keywords: ['youtube', 'ютуб'] },
    { platform: 'github', keywords: ['github'] },
];

function hostnameOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

// Ссылки хранятся как просто label+url (site/model.js) — платформа нигде
// не записана отдельным полем, поэтому определяется на лету: сначала по
// домену (надёжнее), затем по тексту label (нужно для записей без url,
// вроде "Discord: .extree" — там это единственный сигнал).
export function detectPlatform(link: { label: string; url: string }): Platform {
    const host = link.url ? hostnameOf(link.url) : null;
    if (host) {
        const byHost = HOST_RULES.find(rule => rule.hosts.some(h => host === h || host.endsWith(`.${h}`)));
        if (byHost) return byHost.platform;
    }

    const label = link.label.toLowerCase();
    const byLabel = LABEL_RULES.find(rule => rule.keywords.some(k => label.includes(k)));
    if (byLabel) return byLabel.platform;

    return 'generic';
}
