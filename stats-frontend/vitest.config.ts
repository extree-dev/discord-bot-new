import { defineConfig } from 'vitest/config';

// passWithNoTests: сейчас в проекте нет ни одной модели/чистой логики —
// только презентационные компоненты (страница входа), для которых (как и
// в frontend/, см. его CHANGELOG) компонентные тесты сознательно не
// заведены. Как только появится первая логика (например, нормализация
// ответа RSO) — передаётся модельный тест по тому же паттерну, что и в
// frontend/src/features/*/model.test.ts, и флаг можно будет убрать.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        passWithNoTests: true,
    },
});
