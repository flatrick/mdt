const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['.cursor/**', 'node_modules/**']
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        },
        rules: {
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-undef': 'error',
            'eqeqeq': 'warn'
        }
    },
    {
        files: ['scripts/**/*.js'],
        rules: {
            'complexity': ['error', 12],
            'max-lines-per-function': ['error', 80],
            'max-depth': ['error', 4],
            'no-param-reassign': 'error'
        }
    }
];
