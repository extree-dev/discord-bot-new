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
        ignores: ['node_modules/**', 'data/**'],
    },
    // Отключает стилистические правила ESLint, которые пересекаются с
    // Prettier и мешали бы форматированию (порядок важен — должен идти последним).
    prettierConfig,
];
