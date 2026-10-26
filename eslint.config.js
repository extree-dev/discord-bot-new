const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-console': 'off',
            eqeqeq: ['error', 'smart'],
        },
    },
    {
        // frontend/ и stats-frontend/ — отдельные React/TS-проекты каждый
        // со своим eslint.config.js (ESM, JSX/TS-парсинг, браузерные
        // globals) — этот (CommonJS, Node-globals) им не подходит и не
        // должен их трогать; линтятся отдельно (npm run lint внутри
        // каждого, свой шаг в CI).
        ignores: ['node_modules/**', 'data/**', 'frontend/**', 'stats-frontend/**'],
    },
    // Отключает стилистические правила ESLint, которые пересекаются с
    // Prettier и мешали бы форматированию (порядок важен — должен идти последним).
    prettierConfig,
];
