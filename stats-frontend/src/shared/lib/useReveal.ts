import { useEffect } from 'react';

export function useReveal() {
    useEffect(() => {
        // Если пользователь отключил анимации — просто показываем всё
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
            return;
        }

        let observer: IntersectionObserver | null = null;

        // Даем React 100мс, чтобы точно отрендерить все секции
        const timer = setTimeout(() => {
            const elements = document.querySelectorAll('[data-reveal]');
            if (elements.length === 0) return;

            observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            observer?.unobserve(entry.target);
                        }
                    });
                },
                {
                    root: null,
                    // Срабатывает, когда элемент появляется на экране
                    rootMargin: '0px 0px -20px 0px',
                    threshold: 0.01,
                }
            );

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                // Если элемент уже на экране при загрузке — показываем сразу
                if (rect.top < window.innerHeight) {
                    el.classList.add('is-visible');
                } else {
                    observer?.observe(el);
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            if (observer) observer.disconnect();
        };
    }, []);
}
