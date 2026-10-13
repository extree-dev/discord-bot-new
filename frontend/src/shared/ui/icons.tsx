// Иконки сайдбара кабинета (widgets/admin-shell) — тот же рукописный
// SVG-подход, что у иконок платформ выше, но stroke-based в духе
// feature-иконок визитки бота (web/bot-site), а не заливкой.

export function GridIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
    );
}

export function ShieldIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

export function ActivityIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}

export function VoiceIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
    );
}

export function UsersIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

export function MuteIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            <path d="m23 9-6 6M17 9l6 6" />
        </svg>
    );
}

export function BanIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m4.9 4.9 14.2 14.2" />
        </svg>
    );
}

export function LevelsIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 20h4v-6H3v6Zm7 0h4V8h-4v12Zm7 0h4V4h-4v16Z" />
        </svg>
    );
}

export function SearchIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

export function SortIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
        </svg>
    );
}

export function SunIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
    );
}

export function MoonIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.6 15.3A8.5 8.5 0 0 1 8.7 3.4a.6.6 0 0 0-.7-.8A9.5 9.5 0 1 0 21.4 16a.6.6 0 0 0-.8-.7Z" />
        </svg>
    );
}

export function GlobeTinyIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z" />
        </svg>
    );
}

export function ChevronDownIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export function ChevronLeftIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

export function GlobeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm6.93 6h-3.17a15.6 15.6 0 0 0-1.44-3.65A8.03 8.03 0 0 1 18.93 8ZM12 4.04c.83 1.2 1.47 2.53 1.9 3.96h-3.8c.43-1.43 1.07-2.76 1.9-3.96ZM4.26 14a8.1 8.1 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26Zm.81 2h3.17c.32 1.3.8 2.53 1.44 3.65A8.03 8.03 0 0 1 5.07 16Zm3.17-8H5.07a8.03 8.03 0 0 1 4.61-3.65A15.6 15.6 0 0 0 8.24 8ZM12 19.96c-.83-1.2-1.47-2.53-1.9-3.96h3.8c-.43 1.43-1.07 2.76-1.9 3.96ZM14.3 14H9.7a14.6 14.6 0 0 1 0-4h4.6a14.6 14.6 0 0 1 0 4Zm.12 5.65c.64-1.12 1.12-2.35 1.44-3.65h3.17a8.03 8.03 0 0 1-4.61 3.65ZM16.36 14a16.6 16.6 0 0 0 0-4h3.38a8.1 8.1 0 0 1 0 4h-3.38Z" />
        </svg>
    );
}

// Иконки редактора визитки (pages/site-admin, features/edit-site-content)
// и её шапки (widgets/app-shell) — тот же stroke-based рукописный набор,
// что у иконок кабинета выше.

export function LinkChainIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 17H7a5 5 0 0 1 0-10h2" />
            <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
            <path d="M8 12h8" />
        </svg>
    );
}

export function UserIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
        </svg>
    );
}

export function TrashIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
    );
}

export function PlusIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

export function ArrowUpRightIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 17 17 7M9 7h8v8" />
        </svg>
    );
}
