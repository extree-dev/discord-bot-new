// Зеркалит isValidPassword в stats-backend/validation.js (8+ символов,
// буква, цифра) — дублирование простого правила на фронте ради живой
// обратной связи, та же логика, что EMAIL_RE не шарится между
// фронтом и бэком нигде в этом проекте. Вынесено из
// shared/ui/PasswordRequirements в отдельный модуль, а не просто
// экспортировано вместе с компонентом — react-refresh ругается на файлы,
// которые экспортируют и компонент, и обычную функцию.
export interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    { label: 'At least 8 characters', test: p => p.length >= 8 },
    { label: 'Contains a letter', test: p => /[a-zA-Z]/.test(p) },
    { label: 'Contains a number', test: p => /[0-9]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
    return PASSWORD_REQUIREMENTS.every(r => r.test(password));
}
