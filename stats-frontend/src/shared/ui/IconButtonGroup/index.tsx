import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface IconButtonGroupItem {
    key: string;
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'accent' | 'danger';
    active?: boolean;
    disabled?: boolean;
}

interface IconButtonGroupProps {
    items: IconButtonGroupItem[];
    'aria-label'?: string;
}

// Группа иконочных кнопок в одну панель (как тулбар в Linear / Notion).
// Не знает ни про ticket, ни про verify — только про items (SRP, DIP).
// Переиспользуется в любом месте, где нужны compact actions.
export function IconButtonGroup({ items, 'aria-label': ariaLabel }: IconButtonGroupProps) {
    return (
        <div className={styles.group} role="group" aria-label={ariaLabel}>
            {items.map(item => (
                <button
                    key={item.key}
                    type="button"
                    className={[
                        styles.item,
                        item.variant === 'accent' ? styles.accent : '',
                        item.variant === 'danger' ? styles.danger : '',
                        item.active ? styles.active : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    aria-label={item.label}
                    title={item.label}
                >
                    {item.icon}
                </button>
            ))}
        </div>
    );
}

export type { IconButtonGroupItem, IconButtonGroupProps };
