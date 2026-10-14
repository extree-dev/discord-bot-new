export interface SiteLink {
    label: string;
    url: string;
}

export interface Tool {
    title: string;
    /** Теги-платформы: 'Bot' | 'Dashboard' | 'Discord' | ... — свободные строки. */
    tags: string[];
    description: string;
    /** Внешняя ссылка («View website»). Пусто = не показываем. */
    url?: string;
    /** true — вместо ссылки плашка «Non-disclosure agreement-bound». */
    nda?: boolean;
    /** true — вместо ссылки плашка «To be published». */
    upcoming?: boolean;
}

export interface Client {
    name: string;
    /** Годы: '2024 – Present' и т.п. */
    period: string;
}

export interface Community {
    name: string;
    /** Заголовок карточки (может совпадать с name). */
    title: string;
    online: number;
    members: number;
    /** Что делал (строки). */
    responsibilities: string[];
    /** Ссылка на инвайт. */
    url?: string;
}

export interface Showcase {
    title: string;
    /** Теги: 'App' | 'Bot' | 'Branding' | ... */
    tags: string[];
    description: string;
    url?: string;
    nda?: boolean;
    upcoming?: boolean;
}

export interface SiteContent {
    name: string;
    role: string;
    bio: string;
    links: SiteLink[];
    tools?: Tool[];
    clients?: Client[];
    communities?: Community[];
    showcases?: Showcase[];
}

export interface SiteContentResponse extends SiteContent {
    maxLinks: number;
}
