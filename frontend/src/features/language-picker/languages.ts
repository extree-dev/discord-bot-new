import type { ReactElement } from 'react';
import { FlagGbIcon, FlagRuIcon } from '../../shared/ui/icons';

export interface Language {
    Flag: () => ReactElement;
    code: string;
    label: string;
}

// Флаги — свои SVG (FlagRuIcon/FlagGbIcon), не emoji: Unicode
// regional-indicator эмодзи не рендерятся как флаги на Windows
// (показывают буквы кода страны вместо картинки).
export const LANGUAGES: Language[] = [
    { Flag: FlagRuIcon, code: 'RU', label: 'Russian' },
    { Flag: FlagGbIcon, code: 'EN', label: 'English' },
];
