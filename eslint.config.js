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
        // frontend/ — отдельный React/TS-проект со своим eslint.config.js
        // (ESM, JSX/TS-парсинг, браузерные globals) — этот (CommonJS,
        // Node-globals) ему не подходит и не должен его трогать; линтится
        // отдельно (npm run lint внутри frontend/, свой шаг в CI).
        ignores: ['node_modules/**', 'data/**', 'frontend/**'],
    },
    // Отключает стилистические правила ESLint, которые пересекаются с
    // Prettier и мешали бы форматированию (порядок важен — должен идти последним).
    prettierConfig,
];
