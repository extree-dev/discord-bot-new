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
    /** Используется как alt-текст логотипа и ключ для бегущей строки. */
    name: string;
    /** URL картинки логотипа — без него клиент не рендерится. */
    logoUrl: string;
    /** Необязательная подпись под карточкой клиента, например "2024 – Present". */
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
    /** URL баннера карточки в секции work. Пусто = карточка без картинки. */
    imageUrl?: string;
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
    maxClients: number;
    maxShowcases: number;
}
