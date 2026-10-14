import { useEffect } from 'react';

interface DocumentMeta {
    title: string | null;
    lang?: string;
    description?: string;
    ogImage?: string;
}

// Управление <title>, <html lang> и og-метатегами для публичных страниц
// (визитка). Внутри кабинета не используется — там своя шапка.
export function useDocumentMeta({ title, lang = 'en', description, ogImage }: DocumentMeta) {
    useEffect(() => {
        if (!title) return;
        const prev = document.title;
        document.title = title;

        let metaDesc: HTMLMetaElement | null = null;
        let metaOgTitle: HTMLMetaElement | null = null;
        let metaOgDesc: HTMLMetaElement | null = null;
        let metaOgImage: HTMLMetaElement | null = null;

        if (description) {
            metaDesc = ensureMeta('name', 'description');
            metaDesc.content = description;

            metaOgDesc = ensureMeta('property', 'og:description');
            metaOgDesc.content = description;
        }

        metaOgTitle = ensureMeta('property', 'og:title');
        metaOgTitle.content = title;

        if (ogImage) {
            metaOgImage = ensureMeta('property', 'og:image');
            metaOgImage.content = ogImage;
        }

        return () => {
            document.title = prev;
            metaDesc?.remove();
            metaOgTitle?.remove();
            metaOgDesc?.remove();
            metaOgImage?.remove();
        };
    }, [title, description, ogImage]);

    useEffect(() => {
        const prev = document.documentElement.lang;
        document.documentElement.lang = lang;
        return () => {
            document.documentElement.lang = prev;
        };
    }, [lang]);
}

function ensureMeta(attr: 'name' | 'property', value: string): HTMLMetaElement {
    const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`);
    if (existing) return existing;
    const meta = document.createElement('meta');
    meta.setAttribute(attr, value);
    document.head.appendChild(meta);
    return meta;
}