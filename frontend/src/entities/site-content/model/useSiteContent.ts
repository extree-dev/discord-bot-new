import { useEffect, useState } from 'react';
import { getSiteContent } from '../api';
import type { SiteContent } from '../types';

// Единственная точка, через которую страница визитки получает контент.
// Прячем конкретный getSiteContent за хуком — так VisitkaPage не знает
// про shared/api/client и легче мокается в тестах.
export function useSiteContent(): SiteContent | null {
    const [content, setContent] = useState<SiteContent | null>(null);

    useEffect(() => {
        let alive = true;
        getSiteContent()
            .then(data => {
                if (alive) setContent(data);
            })
            .catch(() => {
                if (alive) setContent(null);
            });
        return () => {
            alive = false;
        };
    }, []);

    return content;
}