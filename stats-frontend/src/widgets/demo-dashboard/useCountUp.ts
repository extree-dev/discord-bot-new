import { useEffect, useState } from 'react';

// Простой count-up без внешних зависимостей — используется только карточками
// агентов в демо-дашборде лендинга. Если анимация отключена (reduced motion
// или ещё не "loaded"), сразу отдаёт конечное значение, а не 0 — не
// нужно ждать такого хука, чтобы увидеть осмысленную цифру.
export function useCountUp(target: number, enabled: boolean, durationMs = 700): number {
    const [value, setValue] = useState(enabled ? 0 : target);

    useEffect(() => {
        if (!enabled) {
            setValue(target);
            return;
        }

        let raf = 0;
        const start = performance.now();

        function tick(now: number) {
            const progress = Math.min(1, (now - start) / durationMs);
            setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
            if (progress < 1) raf = requestAnimationFrame(tick);
        }

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, enabled, durationMs]);

    return value;
}
